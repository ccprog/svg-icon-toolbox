"use strict";

var SandboxedModule = require('sandboxed-module');
var isr = require('../lib/istanbul-reporter.js');
var async = require('async');
var path = require('path');
var cheerio = require('cheerio');

describe("module Loaded, function export", function () {
    var fs, os, utils, callback, errorPrinter;
    var iconize, loaded, sourceFn = 'source', text;
    var fsCallbacks, lib, libCallbacks, utilsCallbacks, writeCallback;

    function loadContent(text) {
        loaded = {
            $: cheerio.load(text, { xmlMode: true}),
            sourceFn: sourceFn,
            inline: jasmine.createSpy('inline'),
            write: function(targetFn, cb) {
                writeCallback = cb;
            },
            export: iconize
        };
        spyOn(loaded, 'write').and.callThrough();
    }

    beforeEach(function () {
        fsCallbacks = {};
        lib = {};
        libCallbacks = {};
        utilsCallbacks = {};
        spyOn(path, 'normalize').and.callThrough();
        fs = {
            writeFile: function (fn, content, callback) {
                fsCallbacks.write = callback;
            },
            unlink: function (fn, callback) {
                fsCallbacks.unlink = callback;
            }
        };
        spyOn(fs, 'writeFile').and.callThrough();
        spyOn(fs, 'unlink').and.callThrough();
        os = {
            tmpdir: function () {
                return '/tmp';
            }
        };
        errorPrinter = jasmine.createSpy('errorPrinter');
        utils = {
            testDir: function (dir, callback) {
                utilsCallbacks.testDir = callback;
            },
            raiseErr: function (err, cmd, callback) {
                callback('err');
            },
            errorPrinter: function () {
                return errorPrinter;
            },
            readLines: function (fn, callback) {
                utilsCallbacks.readLines = callback;
            }
        };
        spyOn(utils, 'testDir').and.callThrough();
        spyOn(utils, 'raiseErr').and.callThrough();
        spyOn(utils, 'errorPrinter').and.callThrough();
        spyOn(utils, 'readLines').and.callThrough();
        lib = {
            iconizePng: function (sourceFn, opt, callback) {
                libCallbacks.iconizePng = callback;
            },
            iconizeSvg: function (sourceFn, $, opt, callback) {
                libCallbacks.iconizeSvg = callback;
            }
        };
        spyOn(lib, 'iconizePng').and.callThrough();
        spyOn(lib, 'iconizeSvg').and.callThrough();
        iconize = SandboxedModule.require('../../lib/iconize.js', {
            requires: {
                'async': async, 'fs': fs, 'os': os, 'path': path,
                './utils.js': utils,
                './iconize-png.js': lib.iconizePng,
                './iconize-svg.js': lib.iconizeSvg
            },
            globals: { 'console': { log: () => {} } },
            sourceTransformers: {
                suppressStdOut: function (source) {
                    return source.replace(/process\.stdout\.write/g, 'console.log');
                },
                istanbul: isr.transformer
            }
        });
        text = '<?xml ?><svg><style/></svg>';
        callback = jasmine.createSpy('callback');
    });

    afterEach(function () {
        callback.calls.allArgs().forEach(function (args) {
            expect(args[1]).toBe(loaded);
        });
    });

    it("inits the error printer", function () {
        loadContent(text);
        loaded.export(null, callback);
        expect(utils.errorPrinter).toHaveBeenCalledWith(callback, loaded);
    });

    it("reacts on missing options", function () {
        loadContent(text);
        loaded.export(null, callback);
        expect(utils.testDir).not.toHaveBeenCalled();
        expect(lib.iconizePng).not.toHaveBeenCalled();
        expect(lib.iconizeSvg).not.toHaveBeenCalled();
        expect(utils.raiseErr).toHaveBeenCalledWith(
            'No valid options.', null, errorPrinter
        );
        expect(callback).not.toHaveBeenCalled();
    });

    it("reacts on missing ids", function () {
        loadContent(text);
        loaded.export({}, callback);
        expect(utils.testDir).not.toHaveBeenCalled();
        expect(lib.iconizePng).not.toHaveBeenCalled();
        expect(lib.iconizeSvg).not.toHaveBeenCalled();
        expect(utils.raiseErr).toHaveBeenCalledWith(
            'No valid id list.', null, errorPrinter
        );
        expect(callback).not.toHaveBeenCalled();
        utils.raiseErr.calls.reset();
        callback.calls.reset();
        loaded.export({ ids: {} }, callback);
        expect(utils.raiseErr).toHaveBeenCalledWith(
            'No valid id list.', null, errorPrinter
        );
        expect(callback).not.toHaveBeenCalled();
    });

    it("reacts on normalize errors", function () {
        loadContent(text);
        path.normalize.and.throwError('message');
        loaded.export({ ids: [], format: 'png' }, callback);
        expect(utils.testDir).not.toHaveBeenCalled();
        expect(lib.iconizePng).not.toHaveBeenCalled();
        expect(lib.iconizeSvg).not.toHaveBeenCalled();
        expect(utils.raiseErr.calls.argsFor(0)[0].message).toBe('message');
        expect(utils.raiseErr.calls.argsFor(0)[1]).toBe('file I/O');
        expect(utils.raiseErr.calls.argsFor(0)[2]).toBe(errorPrinter);
        expect(callback).not.toHaveBeenCalled();
    });

    it("reacts on directory errors", function () {
        loadContent(text);
        loaded.export({ ids: [], format: 'png' }, callback);
        utilsCallbacks.testDir('message');
        expect(lib.iconizePng).not.toHaveBeenCalled();
        expect(lib.iconizeSvg).not.toHaveBeenCalled();
        expect(utils.raiseErr).toHaveBeenCalledWith(
            'message', 'file I/O', errorPrinter
        );
        expect(callback).not.toHaveBeenCalled();
    });

    it("reacts on missing/false format", function () {
        loadContent(text);
        loaded.export({ ids: [] }, callback);
        expect(lib.iconizePng).not.toHaveBeenCalled();
        expect(lib.iconizeSvg).not.toHaveBeenCalled();
        expect(utils.raiseErr).toHaveBeenCalledWith(
            'No valid export format.', null, errorPrinter
        );
        expect(callback).not.toHaveBeenCalled();
        utils.raiseErr.calls.reset();
        loaded.export({ ids: [], format: 'txt' }, callback);
        expect(lib.iconizePng).not.toHaveBeenCalled();
        expect(lib.iconizeSvg).not.toHaveBeenCalled();
        expect(utils.raiseErr).toHaveBeenCalledWith(
            'No valid export format.', null, errorPrinter
        );
        expect(callback).not.toHaveBeenCalled();
    });

    it("calls iconizePng", function () {
        loadContent(text);
        loaded.export({ ids: [], format: 'png' }, callback);
        utilsCallbacks.testDir(null, 'dir/');
        expect(loaded.write).toHaveBeenCalled();
        var tmpfile = loaded.write.calls.argsFor(0)[0];
        expect(tmpfile.startsWith('/tmp')).toBe(true);
        expect(tmpfile.endsWith('.svg')).toBe(true);
        expect(typeof loaded.write.calls.argsFor(0)[1]).toBe('function');
        writeCallback(null);
        expect(lib.iconizeSvg).not.toHaveBeenCalled();
        expect(lib.iconizePng.calls.argsFor(0)[0]).toBe(tmpfile);
        expect(lib.iconizePng.calls.argsFor(0)[1]).toEqual({
            ids: [], format: 'png', exportOptions: {}
        });
        expect(typeof lib.iconizePng.calls.argsFor(0)[2]).toBe('function');
        libCallbacks.iconizePng(null);
        expect(fs.unlink.calls.argsFor(0)[0]).toBe(tmpfile);
        expect(typeof fs.unlink.calls.argsFor(0)[1]).toBe('function');
        expect(callback).not.toHaveBeenCalled();
        fsCallbacks.unlink(null);
        expect(callback).toHaveBeenCalled();
        expect(callback.calls.argsFor(0)[0]).toBeFalsy();
    });

    it("calls iconizeSvg", function () {
        loadContent(text);
        var opt = { ids: [], format: 'svg', exportOptions: {} };
        loaded.export(opt, callback);
        utilsCallbacks.testDir(null, 'dir/');
        expect(loaded.inline.calls.argsFor(0)[0]).toEqual({});
        expect(typeof loaded.inline.calls.argsFor(0)[1]).toBe('function');
        loaded.inline.calls.argsFor(0)[1](null);
        expect(loaded.write).toHaveBeenCalled();
        var tmpfile = loaded.write.calls.argsFor(0)[0];
        expect(tmpfile.startsWith('/tmp')).toBe(true);
        expect(tmpfile.endsWith('.svg')).toBe(true);
        expect(typeof loaded.write.calls.argsFor(0)[1]).toBe('function');
        writeCallback(null);
        expect(lib.iconizePng).not.toHaveBeenCalled();
        expect(lib.iconizeSvg.calls.argsFor(0)[0]).toBe(tmpfile);
        expect(typeof lib.iconizeSvg.calls.argsFor(0)[1]).toBe('function');
        expect(lib.iconizeSvg.calls.argsFor(0)[2]).toBe(opt);
        expect(typeof lib.iconizeSvg.calls.argsFor(0)[3]).toBe('function');
        libCallbacks.iconizeSvg(null);
        expect(fs.unlink.calls.argsFor(0)[0]).toBe(tmpfile);
        expect(typeof fs.unlink.calls.argsFor(0)[1]).toBe('function');
        expect(callback).not.toHaveBeenCalled();
        fsCallbacks.unlink(null);
        expect(callback).toHaveBeenCalled();
        expect(callback.calls.argsFor(0)[0]).toBeFalsy();
    });

    it("loads ids from a file", function () {
        loadContent(text);
        loaded.export({ idFile: 'list', format: 'png' }, callback);
        utilsCallbacks.testDir(null, 'dir/');
        writeCallback(null);
        expect(utils.readLines.calls.argsFor(0)[0]).toBe('list');
        expect(typeof utils.readLines.calls.argsFor(0)[1]).toBe('function');
        utilsCallbacks.readLines(null, ['object']);
        expect(lib.iconizePng.calls.argsFor(0)[1].ids).toEqual(['object']);
    });

    it("superceeds ids with ids from a file", function () {
        loadContent(text);
        loaded.export({ ids: ['object1'], idFile: 'list', format: 'png' }, callback);
        utilsCallbacks.testDir(null, 'dir/');
        writeCallback(null);
        expect(utils.readLines.calls.argsFor(0)[0]).toBe('list');
        expect(typeof utils.readLines.calls.argsFor(0)[1]).toBe('function');
        utilsCallbacks.readLines(null, ['object2']);
        expect(lib.iconizePng.calls.argsFor(0)[1].ids).toEqual(['object2']);
    });

    it("reacts on readLines errors", function () {
        loadContent(text);
        loaded.export({ idFile: 'list', format: 'png' }, callback);
        utilsCallbacks.testDir(null, 'dir/');
        writeCallback(null);
        utilsCallbacks.readLines('message');
        expect(utils.raiseErr).toHaveBeenCalledWith(
            'message', 'file I/O', errorPrinter
        );
        expect(callback).not.toHaveBeenCalled();
    });

    it("does not alter loaded file", function () {
        loadContent(text);
        var opt = { ids: [], format: 'svg', exportOptions: {} };
        loaded.export(opt, callback);
        utilsCallbacks.testDir(null, 'dir/');
        loaded.$('style').remove();
        loaded.$('svg').css('fill', 'black');
        loaded.inline.calls.argsFor(0)[1](null);
        writeCallback(null);
        libCallbacks.iconizeSvg(null);
        fsCallbacks.unlink(null);
        expect(loaded.$.xml()).toBe(text);
    });

    it("calls iconizeSvg immediatly if no stylesheet is found", function () {
        text = '<?xml ?><svg></svg>';
        loadContent(text);
        var opt = { ids: [], format: 'svg', exportOptions: {} };
        loaded.export(opt, callback);
        utilsCallbacks.testDir(null, 'dir/');
        writeCallback(null);
        expect(lib.iconizePng).not.toHaveBeenCalled();
        expect(loaded.inline).not.toHaveBeenCalled();
        expect(typeof lib.iconizeSvg.calls.argsFor(0)[1]).toBe('function');
        expect(lib.iconizeSvg.calls.argsFor(0)[2]).toBe(opt);
        expect(typeof lib.iconizeSvg.calls.argsFor(0)[3]).toBe('function');
        libCallbacks.iconizeSvg(null);
        expect(callback).not.toHaveBeenCalled();
        fsCallbacks.unlink(null);
        expect(callback).toHaveBeenCalled();
        expect(callback.calls.argsFor(0)[0]).toBeFalsy();
    });

    it("reacts on inline errors", function () {
        loadContent(text);
        loaded.export({ ids: [], format: 'svg' }, callback);
        utilsCallbacks.testDir(null, 'dir/');
        loaded.inline.calls.argsFor(0)[1]('err');
        expect(errorPrinter.calls.argsFor(0)[0]).toBeTruthy();
    });

    it("reacts on write errors", function () {
        loadContent(text);
        loaded.export({ ids: [], format: 'svg' }, callback);
        utilsCallbacks.testDir(null, 'dir/');
        loaded.inline.calls.argsFor(0)[1](null);
        writeCallback('err');
        expect(errorPrinter.calls.argsFor(0)[0]).toBeTruthy();
    });

    it("reacts on iconizeSvg errors", function () {
        loadContent(text);
        loaded.export({ ids: [], format: 'svg' }, callback);
        utilsCallbacks.testDir(null, 'dir/');
        loaded.inline.calls.argsFor(0)[1](null);
        writeCallback(null);
        libCallbacks.iconizeSvg('err');
        expect(errorPrinter.calls.argsFor(0)[0]).toBeTruthy();
    });

    it("reacts on unlink errors", function () {
        loadContent(text);
        loaded.export({ ids: [], format: 'svg' }, callback);
        utilsCallbacks.testDir(null, 'dir/');
        loaded.inline.calls.argsFor(0)[1](null);
        writeCallback(null);
        libCallbacks.iconizeSvg(null);
        fsCallbacks.unlink('err');
        expect(errorPrinter.calls.argsFor(0)[0]).toBeTruthy();
        expect(callback).not.toHaveBeenCalled();
    });
});