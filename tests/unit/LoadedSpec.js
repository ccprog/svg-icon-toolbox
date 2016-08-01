"use strict";

var SandboxedModule = require('sandboxed-module');
var isr = require('../lib/istanbul-reporter.js');
var async = require('async');
var path = require('path');
var cheerio = require('cheerio');

describe("module Loaded", function () {
    var fs, utils, callback, errorPrinter;
    var Loaded, loaded, sourceFn = 'source';
    var fsCallbacks, lib, libCallbacks, utilsCallbacks;

    function loadContent(text) {
        var $ = cheerio.load(text, { xmlMode: true});
        loaded = new Loaded($, sourceFn);
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
            }
        };
        spyOn(fs, 'writeFile').and.callThrough();
        errorPrinter = jasmine.createSpy('errorPrinter');
        utils = {
            raiseErr: function (err, cmd, callback) {
                callback('err');
            },
            errorPrinter: function () {
                return errorPrinter;
            }
        };
        spyOn(utils, 'raiseErr').and.callThrough();
        spyOn(utils, 'errorPrinter').and.callThrough();
        lib = {
            stylesheet: {
                collect: function (opt, callback) {
                    libCallbacks.collect = callback;
                }
            },
            inline: function ($, ruleset, callback) {
                libCallbacks.inline = callback;
            },
            iconize: jasmine.createSpy('iconize')
        };
        spyOn(lib.stylesheet, 'collect').and.callThrough();
        spyOn(lib, 'inline').and.callThrough();
        Loaded = SandboxedModule.require('../../lib/Loaded.js', {
            requires: {
                'async': async, 'fs': fs, 'path': path,
                './utils.js': utils,
                './inline.js': lib.inline,
                './stylesheet.js': lib.stylesheet,
                './iconize.js': lib.iconize
            },
            globals: { 'console': { log: () => {} } },
            sourceTransformers: {
                suppressStdOut: function (source) {
                    return source.replace(/process\.stdout\.write/g, 'console.log');
                },
                istanbul: isr.transformer
            }
        });
        callback = jasmine.createSpy('callback');
    });

    afterEach(function () {
        callback.calls.allArgs().forEach(function (args) {
            expect(args[1]).toBe(loaded);
        });
    });

    describe("function stylize", function () {
        var text;

        beforeEach(function () {
            text = '<?xml ?><svg><style/></svg>';
        });

        it("inits the error printer", function () {
            loadContent(text);
            loaded.stylize({}, callback);
            expect(utils.errorPrinter).toHaveBeenCalledWith(callback, loaded);
        });

        it("reacts on missing options", function () {
            loadContent(text);
            loaded.stylize(null, callback);
            expect(utils.raiseErr).toHaveBeenCalledWith(
                'No valid options.', null, errorPrinter
            );
            expect(callback).not.toHaveBeenCalled();
        });

        it("reacts on missing sources", function () {
            loadContent(text);
            loaded.stylize({}, callback);
            expect(utils.raiseErr).toHaveBeenCalledWith(
                'No stylesheet supplied.',
                null, errorPrinter
            );
            expect(callback).not.toHaveBeenCalled();
            utils.raiseErr.calls.reset();
            utils.errorPrinter.calls.reset();
            loaded.stylize({ src: {} }, callback);
            expect(utils.raiseErr).toHaveBeenCalledWith(
                'No stylesheet supplied.',
                null, errorPrinter
            );
            expect(callback).not.toHaveBeenCalled();
        });

        it("reacts on collection error", function () {
            loadContent(text);
            loaded.stylize({ src: 'file.css' }, callback);
            libCallbacks.collect('message');
            expect(utils.raiseErr).not.toHaveBeenCalled();
            expect(errorPrinter).toHaveBeenCalledWith('message');
            expect(errorPrinter.calls.count()).toBe(1);
            expect(callback).not.toHaveBeenCalled();
        });

        it("inserts stylesheet", function () {
            loadContent(text);
            var opt = { src: 'file.css' };
            loaded.stylize(opt, callback);
            expect(lib.stylesheet.collect.calls.argsFor(0)[0]).toBe(opt);
            expect(typeof lib.stylesheet.collect.calls.argsFor(0)[1]).toBe('function');
            libCallbacks.collect(null, ['rules']);
            expect(errorPrinter).not.toHaveBeenCalled();
            expect(callback).toHaveBeenCalled();
            expect(callback.calls.argsFor(0)[0]).toBeFalsy();
            loaded.write('fn', callback);
            var $ = cheerio.load(fs.writeFile.calls.argsFor(0)[1], { xmlMode: true });
            expect($('svg style').length).toBe(1);
            expect($('svg defs style').length).toBe(1);
            expect($('style').attr('type')).toBe('text/css');
            expect($('style').contents()[0].type).toBe('cdata');
            expect($('style').text()).toBe('\nrules\n');
        });

        it("inserts multiple stylesheets", function () {
            loadContent(text);
            loaded.stylize({ src: 'file.css' }, callback);
            libCallbacks.collect(null, ['rules1', 'rules2']);
            expect(callback).toHaveBeenCalled();
            expect(callback.calls.argsFor(0)[0]).toBeFalsy();
            loaded.write('fn', callback);
            var $ = cheerio.load(fs.writeFile.calls.argsFor(0)[1], { xmlMode: true });
            expect($('svg style').length).toBe(1);
            expect($('svg defs style').length).toBe(1);
            expect($('style').attr('type')).toBe('text/css');
            expect($('style').contents()[0].type).toBe('cdata');
            expect($('style').text()).toBe('\nrules1\nrules2\n');
        });

        it("inserts stylesheet only into first def element", function () {
            text = '<?xml ?><svg><defs><use/></defs><defs/></svg>';
            loadContent(text);
            loaded.stylize({ src: 'file.css' }, callback);
            libCallbacks.collect(null, ['rules1', 'rules2']);
            loaded.write('fn', callback);
            var $ = cheerio.load(fs.writeFile.calls.argsFor(0)[1], { xmlMode: true });
            expect($('svg style').length).toBe(1);
            expect($('svg defs:first-of-type > style:first-child').length).toBe(1);
            expect($('svg defs:last-of-type style').length).toBe(0);
        });
    });

    describe("function inline", function () {
        var text;

        beforeEach(function () {
            text = '<?xml ?><svg><style>rules</style></svg>';
        });

        it("inits the error printer", function () {
            loadContent(text);
            loaded.inline(null, callback);
            expect(utils.errorPrinter).toHaveBeenCalledWith(callback, loaded);
        });

        it("reacts on collection error", function () {
            loadContent(text);
            loaded.inline(null, callback);
            libCallbacks.collect('message');
            expect(lib.inline).not.toHaveBeenCalled();
            expect(errorPrinter).toHaveBeenCalledWith('message');
            expect(errorPrinter.calls.count()).toBe(1);
            expect(callback).not.toHaveBeenCalled();
        });

        it("finds stylesheets", function () {
            var $ = cheerio.load(text, { xmlMode: true });
            loadContent(text);
            loaded.inline(null, callback);
            expect(lib.inline).not.toHaveBeenCalled();
            expect(typeof lib.stylesheet.collect.calls.argsFor(0)[0]).toBe('object');
            expect(typeof lib.stylesheet.collect.calls.argsFor(0)[1]).toBe('function');
            libCallbacks.collect(null, []);
            expect(lib.inline.calls.argsFor(0)[0][0]).toEqual(($)[0]);
            expect(lib.inline.calls.argsFor(0)[1]).toEqual(['rules']);
            expect(lib.inline.calls.argsFor(0)[2]).toBe(errorPrinter);
            expect(callback).not.toHaveBeenCalled();
        });

        it("adds external stylesheets", function () {
            var $ = cheerio.load(text, { xmlMode: true });
            loadContent(text);
            loaded.inline({src: 'file'}, callback);
            expect(typeof lib.stylesheet.collect.calls.argsFor(0)[0]).toBe('object');
            expect(typeof lib.stylesheet.collect.calls.argsFor(0)[1]).toBe('function');
            libCallbacks.collect(null, ['rules1', 'rules2']);
            expect(lib.inline.calls.argsFor(0)[0][0]).toEqual(($)[0]);
            expect(lib.inline.calls.argsFor(0)[1]).toEqual(['rules1', 'rules2', 'rules']);
        });

        it("reads just added stylesheet correctly", function () {
            var $ = cheerio.load(text, { xmlMode: true });
            loadContent(text);
            loaded.stylize({ src: 'file.css' }, callback);
            libCallbacks.collect(null, ['rules1']);
            loaded.inline({src: 'file'}, callback);
            libCallbacks.collect(null, []);
            expect(lib.inline.calls.argsFor(0)[0][0]).toEqual(($)[0]);
            expect(lib.inline.calls.argsFor(0)[1]).toEqual(['\nrules1\n']);
        });

        it("finds multiple stylesheets", function () {
            text = '<?xml ?><svg><style>rules1</style>' +
                '<defs><style>rules2</style></defs></svg>';
            var $ = cheerio.load(text, { xmlMode: true });
            loadContent(text);
            loaded.inline(null, callback);
            libCallbacks.collect(null, []);
            expect(lib.inline.calls.argsFor(0)[0][0]).toEqual(($)[0]);
            expect(lib.inline.calls.argsFor(0)[1]).toEqual(['rules1', 'rules2']);
        });
    });

    describe("function write", function () {
        var text;

        beforeEach(function () {
            text = '<?xml ?><svg><style/></svg>';
        });

        it("inits the error printer", function () {
            loadContent(text);
            loaded.write('target', callback);
            expect(utils.errorPrinter).toHaveBeenCalledWith(callback, loaded);
        });

        it("reacts on normalize errors", function () {
            loadContent(text);
            path.normalize.and.throwError('message');
            loaded.write('target', callback);
            expect(fs.writeFile).not.toHaveBeenCalled();
            expect(utils.raiseErr.calls.argsFor(0)[0].message).toBe('message');
            expect(utils.raiseErr.calls.argsFor(0)[1]).toBe('file I/O');
            expect(utils.raiseErr.calls.argsFor(0)[2]).toBe(errorPrinter);
            expect(callback).not.toHaveBeenCalled();
        });

        it("reacts on writeFile errors", function () {
            loadContent(text);
            loaded.write('target', callback);
            fsCallbacks.write('message');
            expect(utils.raiseErr).toHaveBeenCalledWith(
                'message', 'file I/O', errorPrinter
            );
            expect(callback).not.toHaveBeenCalled();
        });

        it("writes loaded content to file", function () {
            loadContent(text);
            loaded.write('target', callback);
            expect(fs.writeFile.calls.argsFor(0)[0]).toBe('target');
            expect(fs.writeFile.calls.argsFor(0)[1]).toBe(text);
            expect(typeof fs.writeFile.calls.argsFor(0)[2]).toBe('function');
            fsCallbacks.write(null);
            expect(errorPrinter).not.toHaveBeenCalled();
            expect(callback).toHaveBeenCalled();
            expect(callback.calls.argsFor(0)[0]).toBeFalsy();
        });

        it("uses source filename as default target", function () {
            var text = '<?xml ?><svg><style/></svg>';
            loadContent(text);
            loaded.write(null, callback);
            expect(path.normalize.calls.argsFor(0)[0]).toBe('source');
        });
    });
});