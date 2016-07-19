"use strict";

var SandboxedModule = require('sandboxed-module');
var cheerio = require('cheerio');
var async = require('async');
var prd = require('pretty-data');

describe("module iconize-svg", function () {
    var fs, stdin, utils, spawn, iconize, callback;
    var sourceFn, source, $xml, exportOptions;
    var spawnCallback, writeCallbacks, spawnLineFn, normalizeCallbacks;

    function loadIconize (ids, dimensions) {
        $xml = cheerio.load(source, { xmlMode: true });
        iconize(sourceFn, $xml, {ids: ids, exportOptions: exportOptions}, callback);
        if (dimensions) {
            dimensions.forEach(spawnLineFn);
            spawnCallback(null);
        }
    }

    beforeEach(function () {
        writeCallbacks = {};
        normalizeCallbacks = {};
        fs = {
            writeFile: function(fn, text, callback) {
                writeCallbacks[fn] = callback;
            }
        };
        spyOn(fs, 'writeFile').and.callThrough();
        stdin = {
            write: jasmine.createSpy('write')
        };
        utils = {
            normalize: function (fn, callback) {
                normalizeCallbacks[fn] = callback;
            },
            handleErr: jasmine.createSpy('handleErr')
        };
        spyOn(utils, 'normalize').and.callThrough();
        spawn = jasmine.createSpy('spawn')
                .and.callFake(function (cmd, lineFn, delay, callback) {
            spawnLineFn = lineFn;
            spawnCallback = callback;
            return stdin;
        });
        iconize = SandboxedModule.require('../../lib/iconize-svg.js', {
            requires: { 'async': async, 'pretty-data': prd, 'fs': fs, './utils': utils, './spawn': spawn },
            globals: { 'console': { log: () => {} } }
        });
        callback = jasmine.createSpy('callback');
        sourceFn = 'source';
        source = '<?xml ?><svg width="480" height="260"/>';
        exportOptions = {};
    });

    it("spawns the inkscape shell", function () {
        sourceFn = 'source';
        loadIconize([]);
        expect(spawn.calls.argsFor(0)[0]).toBe('inkscape -S source');
        expect(typeof spawn.calls.argsFor(0)[1]).toBe('function');
        expect(spawn.calls.argsFor(0)[2]).toBe(false);
        expect(typeof spawn.calls.argsFor(0)[3]).toBe('function');
        spawnCallback(null);
        expect(callback).toHaveBeenCalledWith(null);
    });

    it("writes to target file name", function () {
        loadIconize(
            ['object1', 'object2'],
            ['object1,5,5,10,20', 'object2,20,5,30,30']
        );
        expect(utils.normalize.calls.argsFor(0)[0]).toBe('./object1.svg');
        normalizeCallbacks['./object1.svg'](null, './obj1');
        expect(fs.writeFile.calls.argsFor(0)[0]).toBe('./obj1');
        expect(typeof fs.writeFile.calls.argsFor(0)[1]).toBe('string');
        expect(typeof fs.writeFile.calls.argsFor(0)[2]).toBe('function');
        writeCallbacks['./obj1']();
        expect(utils.normalize.calls.argsFor(1)[0]).toBe('./object2.svg');
        normalizeCallbacks['./object2.svg'](null, './obj2');
        expect(fs.writeFile.calls.argsFor(1)[0]).toBe('./obj2');
        expect(typeof fs.writeFile.calls.argsFor(1)[1]).toBe('string');
        expect(typeof fs.writeFile.calls.argsFor(1)[2]).toBe('function');
        writeCallbacks['./obj2']();
        expect(callback).toHaveBeenCalledWith(null);
    });

    it("reacts on normalize errors", function () {
        loadIconize(
            ['object1'],
            ['object1,5,5,10,20']
        );
        expect(utils.normalize.calls.argsFor(0)[0]).toBe('./object1.svg');
        normalizeCallbacks['./object1.svg']('message');
        expect(utils.handleErr.calls.argsFor(0)[0]).toBe('message');
        expect(utils.handleErr.calls.argsFor(0)[1]).toBe('file I/O');
        expect(typeof utils.handleErr.calls.argsFor(0)[2]).toBe('function');
    });

    it("reacts on missing ids", function () {
        loadIconize(
            ['object1'],
            ['object2,20,5,30,30']
        );
        expect(utils.handleErr.calls.argsFor(0)[0]).toBe('object object1 not found in loaded source.');
        expect(utils.handleErr.calls.argsFor(0)[1]).toBe('SVG');
        expect(typeof utils.handleErr.calls.argsFor(0)[2]).toBe('function');
    });

    it("finds and applies dimensions", function () {
        loadIconize(
            ['object1', 'object2'],
            ['object1,5,5,10,20', 'object2,20,5,30,30', 'object3,5,30,15,25']
        );
        normalizeCallbacks['./object1.svg'](null, './obj1');
        var text = fs.writeFile.calls.argsFor(0)[1];
        var $svg = cheerio.load(text, { xmlMode: true })('svg');
        expect($svg.attr('viewBox')).toBe('5 5 10 20');
        expect($svg.attr('width')).toBe('10');
        expect($svg.attr('height')).toBe('20');
        writeCallbacks['./obj1']();
        normalizeCallbacks['./object2.svg'](null, './obj2');
        text = fs.writeFile.calls.argsFor(1)[1];
        $svg = cheerio.load(text, { xmlMode: true })('svg');
        expect($svg.attr('viewBox')).toBe('20 5 30 30');
        expect($svg.attr('width')).toBe('30');
        expect($svg.attr('height')).toBe('30');
        writeCallbacks['./obj2']();
        expect(callback).toHaveBeenCalledWith(null);
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
        normalizeCallbacks['./object1.svg'](null, './obj1');
        var text = fs.writeFile.calls.argsFor(0)[1];
        var $svg = cheerio.load(text, { xmlMode: true })('svg');
        expect($svg.attr('viewBox')).toBe('5 5 10 20');
        expect($svg.attr('width')).toBe('50');
        expect($svg.attr('height')).toBeUndefined();
        expect($svg.attr('preserveAspectRatio')).toBe('mid');
        expect($svg.attr('random')).toBeUndefined();
    });

    it("changes and restores cheerio root object", function () {
        source = '<?xml ?><svg width="480" height="260">' +
            '<g id="object2"/></svg>';
        loadIconize(
            ['object1'],
            ['object1,5,5,10,20']
        );
        normalizeCallbacks['./object1.svg'](null, './obj1');
        var text = fs.writeFile.calls.argsFor(0)[1];
        expect(text).not.toEqual(source);
        text = $xml.xml();
        expect(text).not.toBe(source);
        writeCallbacks['./obj1']();
        text = $xml.xml();
        expect(text).toBe(source);
    });
});