"use strict";

var SandboxedModule = require('sandboxed-module');
var isr = require('../lib/istanbul-reporter.js');
var async = require('async');
var path = require('path');

describe("module iconize-png", function () {
    var stdin, utils, spawn, iconize, callback;
    var sourceFn, exportOptions;
    var spawnLineFn;

    function loadIconize (ids, dir, suffix, postProcess) {
        iconize(sourceFn, {
            ids: ids,
            dir: dir,
            suffix: suffix,
            postProcess: postProcess,
            exportOptions: exportOptions
        }, callback);
    }

    beforeEach(function () {
        spyOn(path, 'normalize').and.callThrough();
        stdin = {
            write: jasmine.createSpy('write')
        };
        utils = {
            handleErr: jasmine.createSpy('handleErr')
        };
        spawn = jasmine.createSpy('spawn')
                .and.callFake(function (cmd, lineFn) {
            spawnLineFn = lineFn;
            return stdin;
        });
        iconize = SandboxedModule.require('../../lib/iconize-png.js', {
            requires: { 'async': async, 'path': path,
                        './utils': utils, './spawn': spawn },
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
        var objects = ['object1', 'object2'];
        loadIconize(objects);
        var commands = [
            stdin.write.calls.argsFor(0)[0],
            stdin.write.calls.argsFor(1)[0]
        ];
        objects.forEach(function (obj) {
            var command = commands.filter(function (cmd) {
                return cmd.indexOf(obj) >= 0;
            })[0];
            expect(command).toContain(`--export-id="${obj}" `);
            expect(command).toContain('--export-id-only ');
            expect(command).toContain(`--export-png="${obj}.png" `);
            expect(command).toContain('source\n');
        });
        expect(stdin.write.calls.argsFor(0)[1]).toBe('utf8');
        expect(stdin.write.calls.argsFor(1)[1]).toBe('utf8');
        expect(stdin.write).toHaveBeenCalledWith('quit\n');
        expect(stdin.write.calls.count()).toBe(3);
    });

    // original inkscape stdout
    var outLines = [
        'Exporting only object with id="object"; all other objects hidden',
        'Background RRGGBBAA: ffffff00',
        'Area 4:236:56:260 exported to 52 x 24 pixels (90 dpi)',
        'Bitmap saved as: object.png'
    ];

    it("reacts on normalize errors", function () {
        path.normalize.and.throwError('message');
        loadIconize(['object1']);
        expect(stdin.write).toHaveBeenCalledWith('quit\n');
        expect(utils.handleErr.calls.argsFor(0)[0].message).toBe('message');
        expect(utils.handleErr.calls.argsFor(0)[1]).toBe('file I/O');
        expect(utils.handleErr.calls.argsFor(0)[2]).toBe(callback);
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
        var command = stdin.write.calls.argsFor(0)[0];
        expect(command).toContain('--export-id="object1" ');
        expect(command).toContain('--export-id-only ');
        expect(command).toContain('--export-png="object1.png" ');
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
        expect(stdin.write.calls.argsFor(0)[0]).toContain('object1-suffix.png');
        loadIconize(['object1'], 'dir/');
        expect(stdin.write.calls.argsFor(2)[0]).toContain('dir/object1.png');
    });

    it("pipes file to postProcess cli from inkscape stdout", function () {
        loadIconize([], null, null, 'command');
        expect(spawn.calls.count()).toBe(1);
        outLines.forEach(spawnLineFn);
        expect(spawn.calls.count()).toBe(2);
        expect(spawn).toHaveBeenCalledWith(
            'command "object.png"',
            null, false,
            callback
        );
    });

    it("pipes file to postProcess function from inkscape stdout", function () {
        var postProcess = jasmine.createSpy('postProcess');
        loadIconize([], null, null, postProcess);
        outLines.forEach(spawnLineFn);
        expect(spawn.calls.count()).toBe(1);
        expect(postProcess).toHaveBeenCalledWith('object.png', callback);
    });
});