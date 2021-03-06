"use strict";

var SandboxedModule = require('sandboxed-module');
var isr = require('../lib/istanbul-reporter.js');
var cheerio = require('cheerio');
var async = require('async');
var fs = require('fs');
var path = require('path');
var prd = require('pretty-data');

describe("module iconize-svg", function () {
    var utils, spawn, iconize, callback;
    var sourceFn, source, $xml, exportOptions;
    var writeCallbacks;
    var spawnCallback, spawnFailure;

    function loadIconize (ids, dimensions, dir, suffix, postProcess) {
        $xml = cheerio.load(source, { xmlMode: true });
        iconize(sourceFn, $xml, {
            ids: ids,
            dir: dir,
            suffix: suffix,
            postProcess: postProcess,
            exportOptions: exportOptions
        }, callback);
        spawnCallback(spawnFailure, dimensions || []);
    }

    beforeEach(function () {
        spyOn(path, 'normalize').and.callThrough();
        writeCallbacks = {};
        spyOn(fs, 'writeFile').and.callFake(function(fn, text, callback) {
            writeCallbacks[fn] = callback;
        });
        utils = {
            raiseErr: function (err, cmd, callback) {
                callback('err');
            },
            computeTransform: jasmine.createSpy('computeTransform')
                                .and.returnValue([])
        };
        spyOn(utils, 'raiseErr').and.callThrough();
        spawnFailure = null;
        spawn = jasmine.createSpy('spawn')
                .and.callFake(function (cmd, shell, callback) {
            spawnCallback = callback;
        });
        iconize = SandboxedModule.require('../../lib/iconize-svg.js', {
            requires: { 'async': async, 'path': path, 'pretty-data': prd, 'fs': fs,
                        './utils': utils, './spawn': spawn },
            globals: { 'console': { log: () => {} } },
            sourceTransformers: {
                istanbul: isr.transformer
            }
        });
        callback = jasmine.createSpy('callback');
        sourceFn = 'source';
        source = '<?xml ?><svg width="480" height="260"/>';
        exportOptions = {};
    });

    it("spawns inkscape command", function () {
        sourceFn = 'source';
        loadIconize([]);
        expect(spawn.calls.argsFor(0)[0]).toBe('inkscape -S source');
        expect(spawn.calls.argsFor(0)[1]).toBe(false);
        expect(typeof spawn.calls.argsFor(0)[2]).toBe('function');
        expect(callback).toHaveBeenCalledWith();
    });

    it("reacts on spawn errors", function () {
        spawnFailure = 'err';
        loadIconize([]);
        expect(callback.calls.argsFor(0)[0]).toBe('err');
    });

    it("writes to target file name", function () {
        loadIconize(
            ['object1', 'object2'],
            ['object1,5,5,10,20', 'object2,20,5,30,30']
        );
        var files = [
            fs.writeFile.calls.argsFor(0)[0],
            fs.writeFile.calls.argsFor(1)[0]
        ];
        expect(files).toContain('object1.svg');
        expect(files).toContain('object2.svg');
        expect(typeof fs.writeFile.calls.argsFor(0)[1]).toBe('string');
        expect(typeof fs.writeFile.calls.argsFor(0)[2]).toBe('function');
        expect(typeof fs.writeFile.calls.argsFor(1)[1]).toBe('string');
        expect(typeof fs.writeFile.calls.argsFor(1)[2]).toBe('function');
        writeCallbacks['object1.svg']();
        writeCallbacks['object2.svg']();
        expect(callback).toHaveBeenCalledWith();
    });

    it("reacts on missing ids", function () {
        loadIconize(
            ['object1'],
            ['object2,20,5,30,30']
        );
        expect(utils.raiseErr.calls.argsFor(0)[0]).toBe('object object1 not found in loaded source.');
        expect(utils.raiseErr.calls.argsFor(0)[1]).toBe('SVG');
        expect(typeof utils.raiseErr.calls.argsFor(0)[2]).toBe('function');
        expect(callback).toHaveBeenCalledWith('err');
    });

    it("reacts on normalize errors", function () {
        path.normalize.and.throwError('message');
        loadIconize(
            ['object1'],
            ['object1,5,5,10,20']
        );
        expect(utils.raiseErr.calls.argsFor(0)[0].message).toBe('message');
        expect(utils.raiseErr.calls.argsFor(0)[1]).toBe('file I/O');
        expect(typeof utils.raiseErr.calls.argsFor(0)[2]).toBe('function');
        expect(callback).toHaveBeenCalledWith('err');
    });

    it("finds and applies dimensions", function () {
        var objects = ['object1', 'object2'];
        loadIconize(
            objects,
            ['object1,5,5,10,20', 'object2,20,5,30,30', 'object3,5,30,15,25']
        );
        expect(utils.computeTransform).toHaveBeenCalledWith('480', '260', undefined, undefined);
        var $svg = {};
        objects.forEach(function (obj) {
            var call = fs.writeFile.calls.allArgs().filter(function (args) {
                return args[0].indexOf(obj) >= 0;
            })[0];
            $svg[obj] = cheerio.load(call[1], { xmlMode: true })('svg');
        });
        expect($svg.object1.attr('viewBox')).toBe('5 5 10 20');
        expect($svg.object1.attr('width')).toBe('10');
        expect($svg.object1.attr('height')).toBe('20');
        expect($svg.object2.attr('viewBox')).toBe('20 5 30 30');
        expect($svg.object2.attr('width')).toBe('30');
        expect($svg.object2.attr('height')).toBe('30');
    });

    it("detects root viewport mods", function () {
        source = '<?xml ?><svg viewBox="vb" preserveAspectRatio="par"' +
                 'transform="transform1" />';
        utils.computeTransform.and.returnValue(['transform2']);
        loadIconize(
            ['object1'],
            ['object1,5,5,10,20']
        );
        expect(utils.computeTransform).toHaveBeenCalledWith(undefined, undefined, 'vb', 'par');
        var text = fs.writeFile.calls.argsFor(0)[1];
        var $svg = cheerio.load(text, { xmlMode: true })('svg');
        expect($svg.attr('transform')).toBe('transform2 transform1');
        source = '<?xml ?><svg viewBox="vb" preserveAspectRatio="par"' +
                 'width="480" height="260" />';
        utils.computeTransform.and.returnValue(['transform']);
        loadIconize(
            ['object1'],
            ['object1,5,5,10,20']
        );
        expect(utils.computeTransform).toHaveBeenCalledWith('480', '260', 'vb', 'par');
        text = fs.writeFile.calls.argsFor(1)[1];
        $svg = cheerio.load(text, { xmlMode: true })('svg');
        expect($svg.attr('transform')).toBe('transform');
    });

    it("understands exportOptions", function () {
         exportOptions = {
            width: 50,
            viewBox: '0 10 20 30',
            preserveAspectRatio: 'mid',
            random: 'rand'
        };
        loadIconize(
            ['object1'],
            ['object1,5,5,10,20']
        );
        var text = fs.writeFile.calls.argsFor(0)[1];
        var $svg = cheerio.load(text, { xmlMode: true })('svg');
        expect($svg.attr('viewBox')).toBe('5 5 10 20');
        expect($svg.attr('width')).toBe('50');
        expect($svg.attr('height')).toBeUndefined();
        expect($svg.attr('preserveAspectRatio')).toBe('mid');
        expect($svg.attr('random')).toBeUndefined();
    });

    it("adds directories and suffixes", function () {
        loadIconize(
            ['object1'], ['object1,5,5,10,20'],
            null, '-suffix'
        );
        expect(fs.writeFile.calls.argsFor(0)[0]).toBe('object1-suffix.svg');
        loadIconize(
            ['object1'], ['object1,5,5,10,20'],
            'dir/'
        );
        expect(fs.writeFile.calls.argsFor(1)[0]).toBe('dir/object1.svg');
    });

    it("pipes file to postProcess cli from inkscape stdout", function () {
        var objects = ['object1', 'object2'];
        loadIconize(
            objects,
            ['object1,5,5,10,20', 'object2,20,5,30,30'],
            null, null, 'command'
        );
        expect(spawn.calls.count()).toBe(1);
        objects.forEach(function (obj) {
            var call = fs.writeFile.calls.allArgs().filter(function (args) {
                return args[0].indexOf(obj) >= 0;
            })[0];
            call[2]();
            expect(spawn.calls.mostRecent().args[0]).toBe(`command ${obj}.svg`);
            expect(spawn.calls.mostRecent().args[1]).toBe(false);
            expect(typeof spawn.calls.mostRecent().args[2]).toBe('function');
            expect(callback).not.toHaveBeenCalled();
            spawn.calls.mostRecent().args[2](null);
        });
        expect(callback).toHaveBeenCalledWith();
    });

    it("pipes file to postProcess function from inkscape stdout", function () {
        var postProcess = jasmine.createSpy('postProcess');
        var objects = ['object1', 'object2'];
        loadIconize(
            objects,
            ['object1,5,5,10,20', 'object2,20,5,30,30'],
            null, null, postProcess
        );
        objects.forEach(function (obj) {
            var call = fs.writeFile.calls.allArgs().filter(function (args) {
                return args[0].indexOf(obj) >= 0;
            })[0];
            call[2]();
            expect(postProcess.calls.mostRecent().args[0]).toBe(`${obj}.svg`);
            expect(typeof postProcess.calls.mostRecent().args[1]).toBe('function');
            expect(callback).not.toHaveBeenCalled();
            postProcess.calls.mostRecent().args[1](null);
        });
        expect(callback).toHaveBeenCalledWith();
    });

    it("changes and restores cheerio root object", function () {
        source = '<?xml ?><svg height="260" transform="transform1" ' +
            'viewBox="vb" preserveAspectRatio="par">' +
            '<g id="object2"/></svg>';
        utils.computeTransform.and.returnValue(['transform2']);
        loadIconize(
            ['object1'],
            ['object1,5,5,10,20']
        );
        var text = fs.writeFile.calls.argsFor(0)[1];
        expect(text).not.toEqual(source);
        text = $xml.xml();
        expect(text).not.toBe(source);
        writeCallbacks['object1.svg']();
        text = $xml.xml();
        expect(text).toBe(source);
    });

    it("reduces complex files", function (done) {
        fs.readFile(`tests/assets/source.svg`, function (err, content) {
            if (err) throw err;
            source = content.toString();
            var objects = ['object1', 'object2'];
            loadIconize(
                objects,
                ['object1,5,5,10,20', 'object2,20,5,30,30']
            );
            var $svg = {};
            objects.forEach(function (obj) {
                var call = fs.writeFile.calls.allArgs().filter(function (args) {
                    return args[0].indexOf(obj) >= 0;
                })[0];
                $svg[obj] = cheerio.load(call[1], { xmlMode: true });
            });
            expect($svg.object1('#path1').length).toBe(1);
            expect($svg.object1('#path2').length).toBe(0);
            expect($svg.object1('#path3').length).toBe(0);
            expect($svg.object1('#grad1').length).toBe(0);
            expect($svg.object1('#grad2').length).toBe(0);
            expect($svg.object1('#cp').length).toBe(1);
            expect($svg.object1('#use1').length).toBe(1);
            expect($svg.object1('#branch1').length).toBe(1);
            expect($svg.object1('#path4').length).toBe(1);
            expect($svg.object1('#use2').length).toBe(0);
            expect($svg.object1('#branch2').length).toBe(1);
            expect($svg.object1('#object1').length).toBe(1);
            expect($svg.object1('#object2').length).toBe(0);
            expect($svg.object1('#rect1').length).toBe(0);
            expect($svg.object1('#rect2').length).toBe(0);
            expect($svg.object1('#branch3').length).toBe(0);
            expect($svg.object1('#path5').length).toBe(0);
            expect($svg.object2('#path1').length).toBe(1);
            expect($svg.object2('#path2').length).toBe(0);
            expect($svg.object2('#path3').length).toBe(0);
            expect($svg.object2('#grad1').length).toBe(1);
            expect($svg.object2('#grad2').length).toBe(0);
            expect($svg.object2('#cp').length).toBe(1);
            expect($svg.object2('#use1').length).toBe(1);
            expect($svg.object2('#branch1').length).toBe(0);
            expect($svg.object2('#path4').length).toBe(0);
            expect($svg.object2('#use2').length).toBe(0);
            expect($svg.object2('#branch2').length).toBe(1);
            expect($svg.object2('#object1').length).toBe(0);
            expect($svg.object2('#object2').length).toBe(1);
            expect($svg.object2('#rect1').length).toBe(1);
            expect($svg.object2('#rect2').length).toBe(1);
            expect($svg.object2('#branch3').length).toBe(0);
            expect($svg.object2('#path5').length).toBe(0);
            done();
        });
    });
});