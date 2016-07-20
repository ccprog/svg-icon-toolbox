"use strict";

var SandboxedModule = require('sandboxed-module');
var isr = require('../lib/istanbul-reporter.js');
var async = require('async');

describe("module iconize-png", function () {
    var stdin, utils, spawn, iconize, callback;
    var sourceFn, exportOptions;
    var spawnLineFn, normalizeCallbacks = {};

    function loadIconize (ids, dir, suffix) {
        iconize(sourceFn, {
            ids: ids,
            dir: dir,
            suffix: suffix,
            exportOptions: exportOptions
        }, callback);
    }

    beforeEach(function () {
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
                .and.callFake(function (cmd, lineFn) {
            spawnLineFn = lineFn;
            return stdin;
        });
        iconize = SandboxedModule.require('../../lib/iconize-png.js', {
            requires: { 'async': async, './utils': utils, './spawn': spawn },
            globals: { 'console': { log: () => {} } },
            sourceTransformers: {
                istanbul: isr.transformer
            }
        });
        callback = jasmine.createSpy('callback');
        sourceFn = 'source';
        exportOptions = {};
    });

    it("spawns the inkscape shell", function () {
        loadIconize([]);
        expect(spawn.calls.argsFor(0)[0]).toBe('inkscape --shell');
        expect(typeof spawn.calls.argsFor(0)[1]).toBe('function');
        expect(spawn.calls.argsFor(0)[2]).toBe(true);
        expect(spawn.calls.argsFor(0)[3]).toBe(callback);
        expect(stdin.write).toHaveBeenCalledWith('quit\n');
    });

    it("constructs the export command", function () {
        loadIconize(['object1', 'object2']);
        expect(utils.normalize.calls.argsFor(0)[0]).toBe('./object1.png');
        normalizeCallbacks['./object1.png'](null, './obj1');
        var command = stdin.write.calls.argsFor(0)[0];
        expect(command).toContain('--export-id="object1" ');
        expect(command).toContain('--export-id-only ');
        expect(command).toContain('--export-png="./obj1" ');
        expect(command).toContain('source\n');
        expect(stdin.write.calls.argsFor(0)[1]).toBe('utf8');
        expect(utils.normalize.calls.argsFor(1)[0]).toBe('./object2.png');
        normalizeCallbacks['./object2.png'](null, './obj2');
        command = stdin.write.calls.argsFor(1)[0];
        expect(command).toContain('--export-id="object2" ');
        expect(command).toContain('--export-id-only ');
        expect(command).toContain('--export-png="./obj2" ');
        expect(command).toContain('source\n');
        expect(stdin.write.calls.argsFor(1)[1]).toBe('utf8');
        expect(stdin.write).toHaveBeenCalledWith('quit\n');
        expect(stdin.write.calls.count()).toBe(3);
    });

    it("pipes file to optipng from inkscape stdout", function () {
        loadIconize([]);
        expect(spawn.calls.count()).toBe(1);
        // original inkscape stdout
        [
            'Exporting only object with id="object"; all other objects hidden',
            'Background RRGGBBAA: ffffff00',
            'Area 4:236:56:260 exported to 52 x 24 pixels (90 dpi)',
            'Bitmap saved as: object.png'
        ].forEach(spawnLineFn);
        expect(spawn.calls.count()).toBe(2);
        expect(spawn).toHaveBeenCalledWith(
            'optipng -o7 --quiet "object.png"',
            null, false,
            callback
        );
    });

    it("reacts on normalize errors", function () {
        loadIconize(['object1']);
        expect(utils.normalize.calls.argsFor(0)[0]).toBe('./object1.png');
        normalizeCallbacks['./object1.png']('message');
        expect(stdin.write).toHaveBeenCalledWith('quit\n');
        expect(utils.handleErr).toHaveBeenCalledWith('message','file I/O', callback);
    });

    it("understands exportOptions", function () {
        exportOptions = {
            'background': '#fff',
            'background-opacity': 1,
            'use-hints': true,
            'dpi': 180,
            'text-to-path': false,
            'ignore-filters': true,
            'width': 50,
            'height': 60,
            'random': true
        };
        loadIconize(['object1']);
        normalizeCallbacks['./object1.png'](null, './obj1');
        var command = stdin.write.calls.argsFor(0)[0];
        expect(command).toContain('--export-id="object1" ');
        expect(command).toContain('--export-id-only ');
        expect(command).toContain('--export-png="./obj1" ');
        for (let prop in exportOptions) {
            var part = ' --export-' + prop;
            if (typeof exportOptions[prop] !== 'boolean') {
                part += `="${exportOptions[prop]}"`;
            }
            if (exportOptions[prop] === false || prop === 'random') {
                 expect(command).not.toContain(part);
            } else {
                 expect(command).toContain(part);
            }
        }
    });

    it("adds directories and suffixes", function () {
        loadIconize(['object1'], null, '-suffix');
        expect(utils.normalize.calls.argsFor(0)[0]).toBe('./object1-suffix.png');
        loadIconize(['object1'], 'dir/');
        expect(utils.normalize.calls.argsFor(1)[0]).toBe('dir//object1.png');
    });
});