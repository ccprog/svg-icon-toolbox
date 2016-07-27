"use strict";

var SandboxedModule = require('sandboxed-module');
var isr = require('../lib/istanbul-reporter.js');
var async = require('async');
var cheerio = require('cheerio');
var path = require('path');

describe("module main", function () {
    var fs, utils, toolbox, callback, errorPrinter;
    var fsCallbacks = {}, lib = {}, libCallbacks = {}, utilsCallbacks = {};

    function loadContent(text, next) {
        toolbox.load('source', callback);
        fsCallbacks.read(null, new Buffer(text));
        fs.readFile.calls.reset();
        callback.calls.reset();
        next();
    }

    beforeEach(function () {
        spyOn(path, 'normalize').and.callThrough();
        fs = {
            readFile: function (fn, callback) {
                fsCallbacks.read = callback;
            },
            writeFile: function (fn, content, callback) {
                fsCallbacks.write = callback;
            }
        };
        spyOn(fs, 'readFile').and.callThrough();
        spyOn(fs, 'writeFile').and.callThrough();
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
            }
        };
        spyOn(utils, 'testDir').and.callThrough();
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
            iconizePng: function (sourceFn, opt, callback) {
                libCallbacks.iconizePng = callback;
            },
            iconizeSvg: function (sourceFn, $, opt, callback) {
                libCallbacks.iconizeSvg = callback;
            }
        };
        spyOn(lib.stylesheet, 'collect').and.callThrough();
        spyOn(lib, 'inline').and.callThrough();
        spyOn(lib, 'iconizePng').and.callThrough();
        spyOn(lib, 'iconizeSvg').and.callThrough();
        toolbox = SandboxedModule.require('../../index.js', {
            requires: {
                'async': async, 'cheerio': cheerio, 'fs': fs, 'path': path,
                './lib/utils.js': utils,
                './lib/inline.js': lib.inline,
                './lib/stylesheet.js': lib.stylesheet,
                './lib/iconize-png.js': lib.iconizePng,
                './lib/iconize-svg.js': lib.iconizeSvg
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

    describe("function load", function () {
        beforeEach(function () {
            spyOn(cheerio, 'load').and.callThrough();
        });

        it("loads file to cheerio object", function () {
            toolbox.load('source', callback);
            expect(cheerio.load).not.toHaveBeenCalled();
            expect(fs.readFile.calls.argsFor(0)[0]).toBe('source');
            expect(typeof fs.readFile.calls.argsFor(0)[1]).toBe('function');
            expect(cheerio.load).not.toHaveBeenCalled();
            fsCallbacks.read(null, new Buffer('<?xml ?><svg/>'));
            expect(cheerio.load.calls.argsFor(0)[0]).toBe('<?xml ?><svg/>');
            expect(cheerio.load.calls.argsFor(0)[1].xmlMode).toBe(true);
            expect(callback).toHaveBeenCalled();
            expect(callback.calls.argsFor(0)[0]).toBeFalsy();
        });

        it("reacts on normalize errors", function () {
            path.normalize.and.throwError('message');
            toolbox.load('source', callback);
            expect(utils.errorPrinter).toHaveBeenCalledWith(callback);
            expect(cheerio.load).not.toHaveBeenCalled();
            expect(utils.raiseErr.calls.argsFor(0)[0].message).toBe('message');
            expect(utils.raiseErr.calls.argsFor(0)[1]).toBe('file I/O');
            expect(utils.raiseErr.calls.argsFor(0)[2]).toBe(errorPrinter);
            expect(callback).not.toHaveBeenCalled();
        });

        it("reacts on readFile errors", function () {
            toolbox.load('source', callback);
            fsCallbacks.read('message');
            expect(cheerio.load).not.toHaveBeenCalled();
            expect(utils.raiseErr).toHaveBeenCalledWith(
                'message', 'file I/O', errorPrinter
            );
            expect(callback).not.toHaveBeenCalled();
        });

        it("reacts on invalid content", function () {
            toolbox.load('source', callback);
            fsCallbacks.read(null, new Buffer('random'));
            expect(utils.raiseErr.calls.argsFor(0)[0]).toBe('No SVG content detected.');
            expect(utils.raiseErr.calls.argsFor(0)[1]).toBe(null);
            expect(typeof utils.raiseErr.calls.argsFor(0)[2]).toBe('function');
            expect(utils.raiseErr.calls.argsFor(1)[2]).toBe(errorPrinter);
            expect(callback).not.toHaveBeenCalled();
        });
    });

    describe("function stylize", function () {
        var text;

        beforeEach(function () {
            text = '<?xml ?><svg><style/></svg>';
        });

        it("reacts on no loaded content", function () {
            toolbox.stylize(null, callback);
            expect(utils.errorPrinter).toHaveBeenCalledWith(callback);
            expect(utils.raiseErr).toHaveBeenCalledWith(
                'No file loaded.', null, errorPrinter
            );
            expect(callback).not.toHaveBeenCalled();
        });

        it("reacts on missing options", function (done) {
            loadContent(text, function () {
                toolbox.stylize(null, callback);
                expect(utils.raiseErr).toHaveBeenCalledWith(
                    'No valid options.', null, errorPrinter
                );
                expect(callback).not.toHaveBeenCalled();
                done();
            });
        });

        it("reacts on missing sources", function (done) {
            loadContent(text, function () {
                toolbox.stylize({}, callback);
                expect(utils.raiseErr).toHaveBeenCalledWith(
                    'No stylesheet supplied.',
                    null, errorPrinter
                );
                expect(callback).not.toHaveBeenCalled();
                utils.raiseErr.calls.reset();
                utils.errorPrinter.calls.reset();
                toolbox.stylize({ src: {} }, callback);
                expect(utils.raiseErr).toHaveBeenCalledWith(
                    'No stylesheet supplied.',
                    null, errorPrinter
                );
                expect(callback).not.toHaveBeenCalled();
                done();
            });
        });

        it("reacts on collection error", function (done) {
            loadContent(text, function () {
                toolbox.stylize({ src: 'file.css' }, callback);
                libCallbacks.collect('message');
                expect(utils.raiseErr).not.toHaveBeenCalled();
                expect(errorPrinter).toHaveBeenCalledWith('message');
                expect(errorPrinter.calls.count()).toBe(1);
                expect(callback).not.toHaveBeenCalled();
                done();
            });
        });

        it("inserts stylesheet", function (done) {
            loadContent(text, function () {
                var opt = { src: 'file.css' };
                toolbox.stylize(opt, callback);
                expect(lib.stylesheet.collect.calls.argsFor(0)[0]).toBe(opt);
                expect(typeof lib.stylesheet.collect.calls.argsFor(0)[1]).toBe('function');
                libCallbacks.collect(null, ['rules']);
                expect(errorPrinter).not.toHaveBeenCalled();
                expect(callback).toHaveBeenCalled();
                expect(callback.calls.argsFor(0)[0]).toBeFalsy();
                toolbox.write('fn', callback);
                var $ = cheerio.load(fs.writeFile.calls.argsFor(0)[1], { xmlMode: true });
                expect($('svg style').length).toBe(1);
                expect($('svg defs style').length).toBe(1);
                expect($('style').attr('type')).toBe('text/css');
                expect($('style').contents()[0].type).toBe('cdata');
                expect($('style').text()).toBe('\nrules\n');
                done();
            });
        });

        it("inserts multiple stylesheets", function (done) {
            loadContent(text, function () {
                toolbox.stylize({ src: 'file.css' }, callback);
                libCallbacks.collect(null, ['rules1', 'rules2']);
                expect(callback).toHaveBeenCalled();
                expect(callback.calls.argsFor(0)[0]).toBeFalsy();
                toolbox.write('fn', callback);
                var $ = cheerio.load(fs.writeFile.calls.argsFor(0)[1], { xmlMode: true });
                expect($('svg style').length).toBe(1);
                expect($('svg defs style').length).toBe(1);
                expect($('style').attr('type')).toBe('text/css');
                expect($('style').contents()[0].type).toBe('cdata');
                expect($('style').text()).toBe('\nrules1\nrules2\n');
                done();
            });
        });

        it("inserts stylesheet only into first def element", function (done) {
            text = '<?xml ?><svg><defs><use/></defs><defs/></svg>';
            loadContent(text, function () {
                toolbox.stylize({ src: 'file.css' }, callback);
                libCallbacks.collect(null, ['rules1', 'rules2']);
                toolbox.write('fn', callback);
                var $ = cheerio.load(fs.writeFile.calls.argsFor(0)[1], { xmlMode: true });
                expect($('svg style').length).toBe(1);
                expect($('svg defs:first-of-type > style:first-child').length).toBe(1);
                expect($('svg defs:last-of-type style').length).toBe(0);
                done();
            });
        });
    });

    describe("function inline", function () {
        var text;

        beforeEach(function () {
            text = '<?xml ?><svg><style>rules</style></svg>';
        });

        it("reacts on no loaded content", function () {
            toolbox.inline(null, callback);
            expect(utils.errorPrinter).toHaveBeenCalledWith(callback);
            expect(lib.inline).not.toHaveBeenCalled();
            expect(utils.raiseErr).toHaveBeenCalledWith(
                'No file loaded.',
                null, errorPrinter
            );
            expect(callback).not.toHaveBeenCalled();
        });

        it("reacts on collection error", function (done) {
            loadContent(text, function () {
                toolbox.inline(null, callback);
                libCallbacks.collect('message');
                expect(lib.inline).not.toHaveBeenCalled();
                expect(errorPrinter).toHaveBeenCalledWith('message');
                expect(errorPrinter.calls.count()).toBe(1);
                expect(callback).not.toHaveBeenCalled();
                done();
            });
        });

        it("finds stylesheets", function (done) {
            var $ = cheerio.load(text, { xmlMode: true });
            loadContent(text, function () {
                toolbox.inline(null, callback);
                expect(lib.inline).not.toHaveBeenCalled();
                expect(typeof lib.stylesheet.collect.calls.argsFor(0)[0]).toBe('object');
                expect(typeof lib.stylesheet.collect.calls.argsFor(0)[1]).toBe('function');
                libCallbacks.collect(null, []);
                expect(lib.inline.calls.argsFor(0)[0][0]).toEqual(($)[0]);
                expect(lib.inline.calls.argsFor(0)[1]).toEqual(['rules']);
                expect(lib.inline.calls.argsFor(0)[2]).toBe(errorPrinter);
                expect(callback).not.toHaveBeenCalled();
                done();
            });
        });

        it("adds external stylesheets", function (done) {
            var $ = cheerio.load(text, { xmlMode: true });
            loadContent(text, function () {
                toolbox.inline({src: 'file'}, callback);
                expect(typeof lib.stylesheet.collect.calls.argsFor(0)[0]).toBe('object');
                expect(typeof lib.stylesheet.collect.calls.argsFor(0)[1]).toBe('function');
                libCallbacks.collect(null, ['rules1', 'rules2']);
                expect(lib.inline.calls.argsFor(0)[0][0]).toEqual(($)[0]);
                expect(lib.inline.calls.argsFor(0)[1]).toEqual(['rules1', 'rules2', 'rules']);
                done();
           });
        });

        it("reads just added stylesheet correctly", function (done) {
            var $ = cheerio.load(text, { xmlMode: true });
            loadContent(text, function () {
                toolbox.stylize({ src: 'file.css' }, callback);
                libCallbacks.collect(null, ['rules1']);
                toolbox.inline({src: 'file'}, callback);
                libCallbacks.collect(null, []);
                expect(lib.inline.calls.argsFor(0)[0][0]).toEqual(($)[0]);
                expect(lib.inline.calls.argsFor(0)[1]).toEqual(['\nrules1\n']);
                done();
           });
        });

        it("finds multiple stylesheets", function (done) {
            text = '<?xml ?><svg><style>rules1</style>' +
                   '<defs><style>rules2</style></defs></svg>';
            var $ = cheerio.load(text, { xmlMode: true });
            loadContent(text, function () {
                toolbox.inline(null, callback);
                libCallbacks.collect(null, []);
                expect(lib.inline.calls.argsFor(0)[0][0]).toEqual(($)[0]);
                expect(lib.inline.calls.argsFor(0)[1]).toEqual(['rules1', 'rules2']);
                done();
            });
        });
    });

    describe("function write", function () {
        var text;

        beforeEach(function () {
            text = '<?xml ?><svg><style/></svg>';
        });

        it("reacts on no loaded content", function () {
            toolbox.write(null, callback);
            expect(utils.errorPrinter).toHaveBeenCalledWith(callback);
            expect(fs.writeFile).not.toHaveBeenCalled();
            expect(utils.raiseErr).toHaveBeenCalledWith(
                'No file loaded.', null, errorPrinter
            );
            expect(callback).not.toHaveBeenCalled();
        });

        it("reacts on normalize errors", function (done) {
            loadContent(text, function () {
                expect(utils.errorPrinter).toHaveBeenCalledWith(callback);
                path.normalize.and.throwError('message');
                toolbox.write('target', callback);
                expect(fs.writeFile).not.toHaveBeenCalled();
                expect(utils.raiseErr.calls.argsFor(0)[0].message).toBe('message');
                expect(utils.raiseErr.calls.argsFor(0)[1]).toBe('file I/O');
                expect(utils.raiseErr.calls.argsFor(0)[2]).toBe(errorPrinter);
                expect(callback).not.toHaveBeenCalled();
                done();
           });
        });

        it("reacts on writeFile errors", function (done) {
            loadContent(text, function () {
                toolbox.write('target', callback);
                fsCallbacks.write('message');
                expect(utils.raiseErr).toHaveBeenCalledWith(
                    'message', 'file I/O', errorPrinter
                );
                expect(callback).not.toHaveBeenCalled();
                done();
           });
        });

        it("writes loaded content to file", function (done) {
            loadContent(text, function () {
                toolbox.write('target', callback);
                expect(fs.writeFile.calls.argsFor(0)[0]).toBe('target');
                expect(fs.writeFile.calls.argsFor(0)[1]).toBe(text);
                expect(typeof fs.writeFile.calls.argsFor(0)[2]).toBe('function');
                fsCallbacks.write(null);
                expect(errorPrinter).not.toHaveBeenCalled();
                expect(callback).toHaveBeenCalled();
                expect(callback.calls.argsFor(0)[0]).toBeFalsy();
                done();
           });
        });

        it("uses source filename as default target", function (done) {
            var text = '<?xml ?><svg><style/></svg>';
            loadContent(text, function () {
                toolbox.write(null, callback);
                expect(path.normalize.calls.argsFor(0)[0]).toBe('source');
                done();
           });
        });
    });

    describe("function export", function () {
        var text, inlineCallback;

        beforeEach(function () {
            spyOn(toolbox, 'inline').and.callFake(function (opt, callback) {
                inlineCallback = callback;
            });
            text = '<?xml ?><svg><style/></svg>';
        });

        it("reacts on no loaded content", function () {
            toolbox.export(null, callback);
            expect(utils.errorPrinter).toHaveBeenCalledWith(callback);
            expect(utils.testDir).not.toHaveBeenCalled();
            expect(lib.iconizePng).not.toHaveBeenCalled();
            expect(lib.iconizeSvg).not.toHaveBeenCalled();
            expect(utils.raiseErr).toHaveBeenCalledWith(
                'No file loaded.', null, errorPrinter
            );
            expect(callback).not.toHaveBeenCalled();
        });

        it("reacts on missing options", function (done) {
            loadContent(text, function () {
                toolbox.export(null, callback);
                expect(utils.errorPrinter).toHaveBeenCalledWith(callback);
                expect(utils.testDir).not.toHaveBeenCalled();
                expect(lib.iconizePng).not.toHaveBeenCalled();
                expect(lib.iconizeSvg).not.toHaveBeenCalled();
                expect(utils.raiseErr).toHaveBeenCalledWith(
                    'No valid options.', null, errorPrinter
                );
                expect(callback).not.toHaveBeenCalled();
                done();
            });
        });

        it("reacts on missing ids", function (done) {
            loadContent(text, function () {
                toolbox.export({}, callback);
                expect(utils.testDir).not.toHaveBeenCalled();
                expect(lib.iconizePng).not.toHaveBeenCalled();
                expect(lib.iconizeSvg).not.toHaveBeenCalled();
                expect(utils.raiseErr).toHaveBeenCalledWith(
                    'No valid id list.', null, errorPrinter
                );
                expect(callback).not.toHaveBeenCalled();
                utils.raiseErr.calls.reset();
                callback.calls.reset();
                toolbox.export({ ids: {} }, callback);
                expect(utils.raiseErr).toHaveBeenCalledWith(
                    'No valid id list.', null, errorPrinter
                );
                expect(callback).not.toHaveBeenCalled();
                done();
            });
        });

        it("reacts on normalize errors", function (done) {
            loadContent(text, function () {
                path.normalize.and.throwError('message');
                toolbox.export({ ids: [] }, callback);
                expect(utils.testDir).not.toHaveBeenCalled();
                expect(lib.iconizePng).not.toHaveBeenCalled();
                expect(lib.iconizeSvg).not.toHaveBeenCalled();
                expect(utils.raiseErr.calls.argsFor(0)[0].message).toBe('message');
                expect(utils.raiseErr.calls.argsFor(0)[1]).toBe('file I/O');
                expect(utils.raiseErr.calls.argsFor(0)[2]).toBe(errorPrinter);
                expect(callback).not.toHaveBeenCalled();
                done();
            });
        });

        it("reacts on directory errors", function (done) {
            loadContent(text, function () {
                toolbox.export({ ids: [] }, callback);
                utilsCallbacks.testDir('message');
                expect(lib.iconizePng).not.toHaveBeenCalled();
                expect(lib.iconizeSvg).not.toHaveBeenCalled();
                expect(utils.raiseErr).toHaveBeenCalledWith(
                    'message', 'file I/O', errorPrinter
                );
                expect(callback).not.toHaveBeenCalled();
                done();
            });
        });

        it("reacts on missing/false format", function (done) {
            loadContent(text, function () {
                toolbox.export({ ids: [] }, callback);
                utilsCallbacks.testDir(null, 'dir/');
                expect(lib.iconizePng).not.toHaveBeenCalled();
                expect(lib.iconizeSvg).not.toHaveBeenCalled();
                expect(utils.raiseErr).toHaveBeenCalledWith(
                    'No valid export format.', null, errorPrinter
                );
                expect(callback).not.toHaveBeenCalled();
                utils.raiseErr.calls.reset();
                toolbox.export({ ids: [], format: 'txt' }, callback);
                utilsCallbacks.testDir(null, 'dir/');
                expect(lib.iconizePng).not.toHaveBeenCalled();
                expect(lib.iconizeSvg).not.toHaveBeenCalled();
                expect(utils.raiseErr).toHaveBeenCalledWith(
                    'No valid export format.', null, errorPrinter
                );
                expect(callback).not.toHaveBeenCalled();
                done();
            });
        });

        it("calls iconizePng", function (done) {
            loadContent(text, function () {
                toolbox.export({ ids: [], format: 'png' }, callback);
                utilsCallbacks.testDir(null, 'dir/');
                expect(lib.iconizeSvg).not.toHaveBeenCalled();
                expect(lib.iconizePng.calls.argsFor(0)[0]).toBe('source');
                expect(lib.iconizePng.calls.argsFor(0)[1]).toEqual({
                    ids: [], format: 'png', exportOptions: {}
                });
                expect(lib.iconizePng.calls.argsFor(0)[2]).toBe(errorPrinter);
                expect(callback).not.toHaveBeenCalled();
                done();
            });
        });

        it("calls iconizeSvg", function (done) {
            loadContent(text, function () {
                var opt = { ids: [], format: 'svg', exportOptions: {} };
                toolbox.export(opt, callback);
                utilsCallbacks.testDir(null, 'dir/');
                expect(lib.iconizePng).not.toHaveBeenCalled();
                expect(lib.iconizeSvg).not.toHaveBeenCalled();
                expect(toolbox.inline.calls.argsFor(0)[0]).toEqual({});
                expect(typeof toolbox.inline.calls.argsFor(0)[1]).toBe('function');
                inlineCallback(null);
                expect(lib.iconizeSvg.calls.argsFor(0)[0]).toBe('source');
                expect(typeof lib.iconizeSvg.calls.argsFor(0)[1]).toBe('function');
                expect(lib.iconizeSvg.calls.argsFor(0)[2]).toBe(opt);
                expect(typeof lib.iconizeSvg.calls.argsFor(0)[3]).toBe('function');
                libCallbacks.iconizeSvg(null);
                expect(errorPrinter).toHaveBeenCalled();
                expect(errorPrinter.calls.argsFor(0)[0]).toBeFalsy();
                expect(callback).not.toHaveBeenCalled();
                done();
            });
        });

        it("calls iconizeSvg immediatly if no stylesheet is found", function (done) {
            text = '<?xml ?><svg></svg>';
            loadContent(text, function () {
                var opt = { ids: [], format: 'svg', exportOptions: {} };
                toolbox.export(opt, callback);
                utilsCallbacks.testDir(null, 'dir/');
                expect(lib.iconizePng).not.toHaveBeenCalled();
                expect(toolbox.inline).not.toHaveBeenCalled();
                expect(lib.iconizeSvg.calls.argsFor(0)[0]).toBe('source');
                expect(typeof lib.iconizeSvg.calls.argsFor(0)[1]).toBe('function');
                expect(lib.iconizeSvg.calls.argsFor(0)[2]).toBe(opt);
                expect(typeof lib.iconizeSvg.calls.argsFor(0)[3]).toBe('function');
                libCallbacks.iconizeSvg(null);
                expect(errorPrinter).toHaveBeenCalled();
                expect(errorPrinter.calls.argsFor(0)[0]).toBeFalsy();
                done();
            });
        });

        it("reacts on inline errors", function (done) {
            loadContent(text, function () {
                toolbox.export({ ids: [], format: 'svg' }, callback);
                utilsCallbacks.testDir(null, 'dir/');
                inlineCallback('err');
                expect(errorPrinter.calls.argsFor(0)[0]).toBeTruthy();
                done();
            });
        });

        it("reacts on iconizeSvg errors", function (done) {
            loadContent(text, function () {
                toolbox.export({ ids: [], format: 'svg' }, callback);
                utilsCallbacks.testDir(null, 'dir/');
                inlineCallback(null);
                libCallbacks.iconizeSvg('err');
                expect(errorPrinter.calls.argsFor(0)[0]).toBeTruthy();
                done();
            });
        });
    });
});