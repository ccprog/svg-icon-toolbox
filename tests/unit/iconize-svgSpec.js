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
    var spawnCallback, cmdCallback, writeCallbacks, spawnLineFn;
    var spawnSuccess;

    function loadIconize (ids, dimensions, dir, suffix, postProcess) {
        $xml = cheerio.load(source, { xmlMode: true });
        iconize(sourceFn, $xml, {
            ids: ids,
            dir: dir,
            suffix: suffix,
            postProcess: postProcess,
            exportOptions: exportOptions
        }, callback);
        spawnCallback(spawnSuccess);
        if (dimensions) {
            dimensions.forEach(spawnLineFn);
            cmdCallback(null);
        }
    }

    beforeEach(function () {
        spyOn(path, 'normalize').and.callThrough();
        writeCallbacks = {};
        spyOn(fs, 'writeFile').and.callFake(function(fn, text, callback) {
            writeCallbacks[fn] = callback;
        });
        utils = {
            handleErr: function (err, cmd, callback) {
                callback('err');
            },
            computeTransform: jasmine.createSpy('computeTransform')
                                .and.returnValue([])
        };
        spyOn(utils, 'handleErr').and.callThrough();
        spawnSuccess = null;
        spawn = jasmine.createSpy('spawn')
                .and.callFake(function (cmd, lineFn, delay, cmdCb, spawnCb) {
            spawnLineFn = lineFn;
            cmdCallback = cmdCb;
            spawnCallback = spawnCb;
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
        expect(typeof spawn.calls.argsFor(0)[1]).toBe('function');
        expect(spawn.calls.argsFor(0)[2]).toBe(false);
        expect(typeof spawn.calls.argsFor(0)[3]).toBe('function');
        cmdCallback(null);
        expect(callback).toHaveBeenCalledWith(null);
    });

    it("reacts on spawn errors", function () {
        spawnSuccess = 'err';
        loadIconize([]);
        expect(callback).toHaveBeenCalledWith('err');
    });

    it("reacts on command errors", function () {
        loadIconize([]);
        cmdCallback('err');
        expect(callback).toHaveBeenCalledWith('err');
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
        expect(callback).toHaveBeenCalledWith(null);
    });

    it("reacts on normalize errors", function () {
        path.normalize.and.throwError('message');
        loadIconize(
            ['object1'],
            ['object1,5,5,10,20']
        );
        expect(utils.handleErr.calls.argsFor(0)[0].message).toBe('message');
        expect(utils.handleErr.calls.argsFor(0)[1]).toBe('file I/O');
        expect(typeof utils.handleErr.calls.argsFor(0)[2]).toBe('function');
        expect(callback).toHaveBeenCalledWith('err');
    });

    it("reacts on missing ids", function () {
        loadIconize(
            ['object1'],
            ['object2,20,5,30,30']
        );
        expect(utils.handleErr.calls.argsFor(0)[0]).toBe('object object1 not found in loaded source.');
        expect(utils.handleErr.calls.argsFor(0)[1]).toBe('SVG');
        expect(typeof utils.handleErr.calls.argsFor(0)[2]).toBe('function');
        expect(callback).toHaveBeenCalledWith('err');
    });

    it("finds and applies dimensions", function () {
        loadIconize(
            ['object1', 'object2'],
            ['object1,5,5,10,20', 'object2,20,5,30,30', 'object3,5,30,15,25']
        );
        expect(utils.computeTransform).toHaveBeenCalledWith('480', '260', undefined, undefined);
        var text = fs.writeFile.calls.argsFor(0)[1];
        var $svg = cheerio.load(text, { xmlMode: true })('svg');
        expect($svg.attr('viewBox')).toBe('5 5 10 20');
        expect($svg.attr('width')).toBe('10');
        expect($svg.attr('height')).toBe('20');
        writeCallbacks['object1.svg']();
        text = fs.writeFile.calls.argsFor(1)[1];
        $svg = cheerio.load(text, { xmlMode: true })('svg');
        expect($svg.attr('viewBox')).toBe('20 5 30 30');
        expect($svg.attr('width')).toBe('30');
        expect($svg.attr('height')).toBe('30');
        writeCallbacks['object2.svg']();
        expect(callback).toHaveBeenCalledWith(null);
    });

    it("detects root viewport mods", function () {
        source = '<?xml ?><svg viewBox="vb" preserveAspectRatio="par"' +
                 'transform="transform1" />';
        utils.computeTransform.and.returnValue(['transform2']);
        spawnCallback(null);
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
        loadIconize(
            ['object1'], ['object1,5,5,10,20'],
            null, null, 'command'
        );
        expect(spawn.calls.count()).toBe(1);
        writeCallbacks['object1.svg']();
        expect(spawn.calls.count()).toBe(2);
        expect(spawn.calls.argsFor(1)[0]).toBe('command "object1.svg"');
        expect(spawn.calls.argsFor(1)[1]).toBe(null);
        expect(spawn.calls.argsFor(1)[2]).toBe(false);
        expect(typeof spawn.calls.argsFor(1)[3]).toBe('function');
    });

    it("pipes file to postProcess function from inkscape stdout", function () {
        var postProcess = jasmine.createSpy('postProcess');
        loadIconize(
            ['object1'], ['object1,5,5,10,20'],
            null, null, postProcess
        );
        writeCallbacks['object1.svg']();
        expect(spawn.calls.count()).toBe(1);
        expect(postProcess.calls.argsFor(0)[0]).toBe('object1.svg');
        expect(typeof postProcess.calls.argsFor(0)[1]).toBe('function');
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
            loadIconize(
                ['object1', 'object2'],
                ['object1,5,5,10,20', 'object2,20,5,30,30']
            );
            var objText1, objText2;
            if (fs.writeFile.calls.argsFor(0)[0] === 'object1.svg') {
                objText1 = fs.writeFile.calls.argsFor(0)[1];
                objText2 = fs.writeFile.calls.argsFor(1)[1];
            } else {
                objText1 = fs.writeFile.calls.argsFor(1)[1];
                objText2 = fs.writeFile.calls.argsFor(0)[1];
            }
            var $obj1 = cheerio.load(objText1, {xmlMode: true});
            expect($obj1('#path1').length).toBe(1);
            expect($obj1('#path2').length).toBe(0);
            expect($obj1('#path3').length).toBe(0);
            expect($obj1('#grad1').length).toBe(0);
            expect($obj1('#grad2').length).toBe(0);
            expect($obj1('#cp').length).toBe(1);
            expect($obj1('#use1').length).toBe(1);
            expect($obj1('#branch1').length).toBe(1);
            expect($obj1('#path4').length).toBe(1);
            expect($obj1('#use2').length).toBe(0);
            expect($obj1('#branch2').length).toBe(1);
            expect($obj1('#object1').length).toBe(1);
            expect($obj1('#object2').length).toBe(0);
            expect($obj1('#rect1').length).toBe(0);
            expect($obj1('#rect2').length).toBe(0);
            expect($obj1('#branch3').length).toBe(0);
            expect($obj1('#path5').length).toBe(0);
            var $obj2 = cheerio.load(objText2, {xmlMode: true});
            expect($obj2('#path1').length).toBe(1);
            expect($obj2('#path2').length).toBe(0);
            expect($obj2('#path3').length).toBe(0);
            expect($obj2('#grad1').length).toBe(1);
            expect($obj2('#grad2').length).toBe(0);
            expect($obj2('#cp').length).toBe(1);
            expect($obj2('#use1').length).toBe(1);
            expect($obj2('#branch1').length).toBe(0);
            expect($obj2('#path4').length).toBe(0);
            expect($obj2('#use2').length).toBe(0);
            expect($obj2('#branch2').length).toBe(1);
            expect($obj2('#object1').length).toBe(0);
            expect($obj2('#object2').length).toBe(1);
            expect($obj2('#rect1').length).toBe(1);
            expect($obj2('#rect2').length).toBe(1);
            expect($obj2('#branch3').length).toBe(0);
            expect($obj2('#path5').length).toBe(0);
            done();
        });
    });
});