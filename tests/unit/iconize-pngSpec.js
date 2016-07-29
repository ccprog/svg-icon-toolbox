"use strict";

var SandboxedModule = require('sandboxed-module');
var isr = require('../lib/istanbul-reporter.js');
var async = require('async');
var path = require('path');

describe("module iconize-png", function () {
    var utils, spawn, iconize, callback;
    var sourceFn, exportOptions;
    var shell, spawnCallback, spawnFailure;

    function loadIconize (ids, dir, suffix, postProcess) {
        iconize(sourceFn, {
            ids: ids,
            dir: dir,
            suffix: suffix,
            postProcess: postProcess,
            exportOptions: exportOptions
        }, callback);
        spawnCallback(spawnFailure, shell);
    }

    beforeEach(function () {
        spyOn(path, 'normalize').and.callThrough();
        shell =  jasmine.createSpy('shell');
        utils = {
            raiseErr: jasmine.createSpy('raiseErr')
        };
        spawnFailure = null;
        spawn = jasmine.createSpy('spawn')
                .and.callFake(function (cmd, shell, callback) {
            spawnCallback = callback;
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
        expect(spawn.calls.argsFor(0)[1]).toBe(true);
        expect(typeof spawn.calls.argsFor(0)[2]).toBe('function');
        expect(shell.calls.argsFor(0)[0]).toBe('quit\n');
        expect(shell.calls.argsFor(0)[1]).toBe(null);
        expect(typeof shell.calls.argsFor(0)[2]).toBe('function');
        expect(callback).toHaveBeenCalledWith(null);
    });

    it("hands through spawn call errors", function () {
        spawnFailure = 'err';
        loadIconize([]);
        expect(callback).toHaveBeenCalledWith('err');
    });

    it("constructs the export command", function () {
        var objects = ['object1', 'object2'];
        loadIconize(objects);
        objects.forEach(function (obj) {
            var call = shell.calls.allArgs().filter(function (args) {
                return args[0].indexOf(obj) >= 0;
            })[0];
            expect(call[0]).toContain(` --export-id="${obj}"`);
            expect(call[0]).toContain(' --export-id-only');
            expect(call[0]).toContain(` --export-png="${obj}.png"`);
            expect(call[0]).toContain('source');
            expect(call[0]).toContain('\n');
            expect(call[1]).toEqual(new RegExp(`Bitmap.*: (.*${obj}.png)$`));
            expect(typeof call[2]).toBe('function');
            expect(callback).not.toHaveBeenCalled();
            call[2](null, `${obj}.png`);
        });
        expect(shell.calls.count()).toBe(3);
        expect(shell.calls.argsFor(2)[0]).toBe('quit\n');
        expect(callback).toHaveBeenCalledWith(null);
    });

    it("reacts on normalize errors", function () {
        path.normalize.and.throwError('message');
        loadIconize(['object1']);
        expect(utils.raiseErr.calls.argsFor(0)[0].message).toBe('message');
        expect(utils.raiseErr.calls.argsFor(0)[1]).toBe('file I/O');
        expect(typeof utils.raiseErr.calls.argsFor(0)[2]).toBe('function');
        utils.raiseErr.calls.argsFor(0)[2]('err');
        expect(shell.calls.argsFor(0)[0]).toBe('quit\n');
        expect(callback).toHaveBeenCalledWith('err');
    });

    it("reacts on shell errors", function () {
        loadIconize(['object1']);
        shell.calls.argsFor(0)[2]('err');
        expect(utils.raiseErr.calls.argsFor(0)[0]).toBe('err');
        expect(utils.raiseErr.calls.argsFor(0)[1]).toBe('file I/O');
        expect(typeof utils.raiseErr.calls.argsFor(0)[2]).toBe('function');
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
        var command = shell.calls.argsFor(0)[0];
        expect(command).toContain(' --export-id="object1"');
        expect(command).toContain(' --export-id-only');
        expect(command).toContain(' --export-png="object1.png"');
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
        expect(shell.calls.argsFor(0)[0]).toContain('object1-suffix.png');
        loadIconize(['object1'], 'dir/');
        expect(shell.calls.argsFor(1)[0]).toContain('dir/object1.png');
    });

    it("pipes file to postProcess cli from inkscape stdout", function () {
        var objects = ['object1', 'object2'];
        loadIconize(objects, null, null, 'command');
        objects.forEach(function (obj) {
            var call = shell.calls.allArgs().filter(function (args) {
                return args[0].indexOf(obj) >= 0;
            })[0];
            call[2](null, `${obj}.png`);
            expect(spawn.calls.mostRecent().args[0]).toBe(`command ${obj}.png`);
            expect(spawn.calls.mostRecent().args[1]).toBe(false);
            expect(typeof spawn.calls.mostRecent().args[2]).toBe('function');
            expect(callback).not.toHaveBeenCalled();
            spawn.calls.mostRecent().args[2](null);
        });
        expect(callback).toHaveBeenCalledWith(null);
    });

    it("pipes file to postProcess function from inkscape stdout", function () {
        var postProcess = jasmine.createSpy('postProcess');
        var objects = ['object1', 'object2'];
        loadIconize(['object1', 'object2'], null, null, postProcess);
        objects.forEach(function (obj) {
            var call = shell.calls.allArgs().filter(function (args) {
                return args[0].indexOf(obj) >= 0;
            })[0];
            call[2](null, `${obj}.png`);
            expect(postProcess.calls.mostRecent().args[0]).toBe(`${obj}.png`);
            expect(typeof postProcess.calls.mostRecent().args[1]).toBe('function');
            expect(callback).not.toHaveBeenCalled();
            postProcess.calls.mostRecent().args[1](null);
        });
        expect(callback).toHaveBeenCalledWith(null);
    });
});