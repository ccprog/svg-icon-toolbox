"use strict";

var SandboxedModule = require('sandboxed-module');
var isr = require('../lib/istanbul-reporter.js');
var async = require('async');
var cheerio = require('cheerio');

describe("module main", function () {
    var fs, utils, toolbox, callback;
    var fsCallbacks = {}, lib = {}, libCallbacks = {}, utilsCallbacks = {};

    function loadContent(text, next) {
        toolbox.load('source', callback);
        utilsCallbacks.normalize(null, 'source');
        fsCallbacks.read(null, new Buffer(text));
        utils.normalize.calls.reset();
        fs.readFile.calls.reset();
        callback.calls.reset();
        next();
    }

    beforeEach(function () {
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
        utils = {
            normalize: function (fn, callback) {
                utilsCallbacks.normalize = callback;
            },
            testDir: function (dir, callback) {
                utilsCallbacks.testDir = callback;
            },
            handleErr: function (err, cmd, callback) {
                callback('err');
            }
        };
        spyOn(utils, 'normalize').and.callThrough();
        spyOn(utils, 'testDir').and.callThrough();
        spyOn(utils, 'handleErr').and.callThrough();
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
                'async': async, 'cheerio': cheerio, 'fs': fs,
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
            expect(utils.normalize.calls.argsFor(0)[0]).toBe('source');
            expect(typeof utils.normalize.calls.argsFor(0)[1]).toBe('function');
            expect(fs.readFile).not.toHaveBeenCalled();
            expect(cheerio.load).not.toHaveBeenCalled();
            utilsCallbacks.normalize(null, 'source');
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
            toolbox.load('source', callback);
            utilsCallbacks.normalize('message');
            expect(fs.readFile).not.toHaveBeenCalled();
            expect(cheerio.load).not.toHaveBeenCalled();
            expect(utils.handleErr).toHaveBeenCalledWith('message', 'file I/O', callback);
            expect(callback.calls.argsFor(0)[0]).toBeTruthy();
        });

        it("reacts on readFile errors", function () {
            toolbox.load('source', callback);
            utilsCallbacks.normalize(null, 'source');
            fsCallbacks.read('message');
            expect(cheerio.load).not.toHaveBeenCalled();
            expect(utils.handleErr).toHaveBeenCalledWith('message', 'file I/O', callback);
            expect(callback.calls.argsFor(0)[0]).toBeTruthy();
        });

        it("reacts on invalid content", function () {
            toolbox.load('source', callback);
            utilsCallbacks.normalize(null, 'source');
            fsCallbacks.read(null, new Buffer('random'));
            expect(utils.handleErr).toHaveBeenCalledWith(
                'No SVG content detected.',
                null, callback
            );
            expect(callback.calls.argsFor(0)[0]).toBeTruthy();
        });
    });

    describe("function stylize", function () {
        var text;

        beforeEach(function () {
            text = '<?xml ?><svg><style/></svg>';
        });

        it("reacts on no loaded content", function () {
            toolbox.stylize(null, callback);
            expect(utils.handleErr).toHaveBeenCalledWith(
                'No file loaded.',
                null, callback
            );
            expect(callback.calls.argsFor(0)[0]).toBeTruthy();
        });

        it("reacts on missing options", function (done) {
            loadContent(text, function () {
                toolbox.stylize(null, callback);
                expect(utils.handleErr).toHaveBeenCalledWith(
                    'No valid options.',
                    null, callback
                );
                expect(callback.calls.argsFor(0)[0]).toBeTruthy();
                done();
            });
        });

        it("reacts on missing sources", function (done) {
            loadContent(text, function () {
                toolbox.stylize({}, callback);
                expect(utils.handleErr).toHaveBeenCalledWith(
                    'No stylesheet supplied.',
                    null, callback
                );
                expect(callback.calls.argsFor(0)[0]).toBeTruthy();
                utils.handleErr.calls.reset();
                callback.calls.reset();
                toolbox.stylize({ src: {} }, callback);
                expect(utils.handleErr).toHaveBeenCalledWith(
                    'No stylesheet supplied.',
                    null, callback
                );
                expect(callback.calls.argsFor(0)[0]).toBeTruthy();
                done();
            });
        });

        it("reacts on collection error", function (done) {
            loadContent(text, function () {
                toolbox.stylize({ src: 'file.css' }, callback);
                libCallbacks.collect('message');
                expect(utils.handleErr).not.toHaveBeenCalled();
                expect(callback.calls.argsFor(0)[0]).toBeTruthy();
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
                expect(callback).toHaveBeenCalled();
                expect(callback.calls.argsFor(0)[0]).toBeFalsy();
                toolbox.write(null, callback);
                utilsCallbacks.normalize(null, 'fn');
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
                toolbox.write(null, callback);
                utilsCallbacks.normalize(null, 'fn');
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
                toolbox.write(null, callback);
                utilsCallbacks.normalize(null, 'fn');
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
            expect(lib.inline).not.toHaveBeenCalled();
            expect(utils.handleErr).toHaveBeenCalledWith(
                'No file loaded.',
                null, callback
            );
            expect(callback.calls.argsFor(0)[0]).toBeTruthy();
        });

        it("reacts on collection error", function (done) {
            loadContent(text, function () {
                toolbox.inline(null, callback);
                libCallbacks.collect('message');
                expect(lib.inline).not.toHaveBeenCalled();
                expect(utils.handleErr).not.toHaveBeenCalled();
                expect(callback.calls.argsFor(0)[0]).toBeTruthy();
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
                expect(typeof lib.inline.calls.argsFor(0)[2]).toBe('function');
                libCallbacks.inline(null);
                expect(callback).toHaveBeenCalled();
                expect(callback.calls.argsFor(0)[0]).toBeFalsy();
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
            expect(utils.normalize).not.toHaveBeenCalled();
            expect(fs.writeFile).not.toHaveBeenCalled();
            expect(utils.handleErr).toHaveBeenCalledWith(
                'No file loaded.',
                null, callback
            );
            expect(callback.calls.argsFor(0)[0]).toBeTruthy();
        });

        it("reacts on normalize errors", function (done) {
            loadContent(text, function () {
                toolbox.write('target', callback);
                utilsCallbacks.normalize('message');
                expect(fs.writeFile).not.toHaveBeenCalled();
                expect(utils.handleErr).toHaveBeenCalledWith('message', 'file I/O', callback);
                expect(callback.calls.argsFor(0)[0]).toBeTruthy();
                done();
           });
        });

        it("reacts on writeFile errors", function (done) {
            loadContent(text, function () {
                toolbox.write('target', callback);
                utilsCallbacks.normalize(null, 'source');
                fsCallbacks.write('message');
                expect(utils.handleErr).toHaveBeenCalledWith('message', 'file I/O', callback);
                expect(callback.calls.argsFor(0)[0]).toBeTruthy();
                done();
           });
        });

        it("writes loaded content to file", function (done) {
            loadContent(text, function () {
                toolbox.write('target1', callback);
                expect(fs.writeFile).not.toHaveBeenCalled();
                expect(utils.normalize.calls.argsFor(0)[0]).toBe('target1');
                expect(typeof utils.normalize.calls.argsFor(0)[1]).toBe('function');
                utilsCallbacks.normalize(null, 'target2');
                expect(fs.writeFile.calls.argsFor(0)[0]).toBe('target2');
                expect(fs.writeFile.calls.argsFor(0)[1]).toBe(text);
                expect(typeof fs.writeFile.calls.argsFor(0)[2]).toBe('function');
                fsCallbacks.write(null);
                expect(callback).toHaveBeenCalled();
                expect(callback.calls.argsFor(0)[0]).toBeFalsy();
                done();
           });
        });

        it("uses source filename as default target", function (done) {
            var text = '<?xml ?><svg><style/></svg>';
            loadContent(text, function () {
                toolbox.write(null, callback);
                expect(utils.normalize.calls.argsFor(0)[0]).toBe('source');
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
            expect(utils.normalize).not.toHaveBeenCalled();
            expect(utils.testDir).not.toHaveBeenCalled();
            expect(lib.iconizePng).not.toHaveBeenCalled();
            expect(lib.iconizeSvg).not.toHaveBeenCalled();
            expect(utils.handleErr).toHaveBeenCalledWith(
                'No file loaded.',
                null, callback
            );
            expect(callback.calls.argsFor(0)[0]).toBeTruthy();
        });

        it("reacts on missing options", function (done) {
            loadContent(text, function () {
                toolbox.export(null, callback);
                expect(utils.normalize).not.toHaveBeenCalled();
                expect(utils.testDir).not.toHaveBeenCalled();
                expect(lib.iconizePng).not.toHaveBeenCalled();
                expect(lib.iconizeSvg).not.toHaveBeenCalled();
                expect(utils.handleErr).toHaveBeenCalledWith(
                    'No valid options.',
                    null, callback
                );
                expect(callback.calls.argsFor(0)[0]).toBeTruthy();
                done();
            });
        });

        it("reacts on missing ids", function (done) {
            loadContent(text, function () {
                toolbox.export({}, callback);
                expect(utils.normalize).not.toHaveBeenCalled();
                expect(utils.testDir).not.toHaveBeenCalled();
                expect(lib.iconizePng).not.toHaveBeenCalled();
                expect(lib.iconizeSvg).not.toHaveBeenCalled();
                expect(utils.handleErr).toHaveBeenCalledWith(
                    'No valid id list.',
                    null, callback
                );
                expect(callback.calls.argsFor(0)[0]).toBeTruthy();
                utils.handleErr.calls.reset();
                callback.calls.reset();
                toolbox.export({ ids: {} }, callback);
                expect(utils.handleErr).toHaveBeenCalledWith(
                    'No valid id list.',
                    null, callback
                );
                expect(callback.calls.argsFor(0)[0]).toBeTruthy();
                done();
            });
        });

        it("reacts on normalize errors", function (done) {
            loadContent(text, function () {
                toolbox.export({ ids: [] }, callback);
                utilsCallbacks.normalize('message');
                expect(utils.testDir).not.toHaveBeenCalled();
                expect(lib.iconizePng).not.toHaveBeenCalled();
                expect(lib.iconizeSvg).not.toHaveBeenCalled();
                expect(utils.handleErr).toHaveBeenCalledWith('message', 'file I/O', callback);
                expect(callback.calls.argsFor(0)[0]).toBeTruthy();
                done();
            });
        });

        it("reacts on directory errors", function (done) {
            loadContent(text, function () {
                toolbox.export({ ids: [] }, callback);
                utilsCallbacks.normalize(null, 'dir/');
                utilsCallbacks.testDir('message');
                expect(lib.iconizePng).not.toHaveBeenCalled();
                expect(lib.iconizeSvg).not.toHaveBeenCalled();
                expect(utils.handleErr).toHaveBeenCalledWith('message', 'file I/O', callback);
                expect(callback.calls.argsFor(0)[0]).toBeTruthy();
                done();
            });
        });

        it("reacts on missing/false format", function (done) {
            loadContent(text, function () {
                toolbox.export({ ids: [] }, callback);
                utilsCallbacks.normalize(null, 'dir/');
                utilsCallbacks.testDir(null, 'dir/');
                expect(lib.iconizePng).not.toHaveBeenCalled();
                expect(lib.iconizeSvg).not.toHaveBeenCalled();
                expect(utils.handleErr).toHaveBeenCalledWith(
                    'No valid export format.',
                    null, callback
                );
                expect(callback.calls.argsFor(0)[0]).toBeTruthy();
                utils.handleErr.calls.reset();
                toolbox.export({ ids: [], format: 'txt' }, callback);
                utilsCallbacks.normalize(null, 'dir/');
                utilsCallbacks.testDir(null, 'dir/');
                expect(lib.iconizePng).not.toHaveBeenCalled();
                expect(lib.iconizeSvg).not.toHaveBeenCalled();
                expect(utils.handleErr).toHaveBeenCalledWith(
                    'No valid export format.',
                    null, callback
                );
                expect(callback.calls.argsFor(1)[0]).toBeTruthy();
                done();
            });
        });

        it("calls iconizePng", function (done) {
            loadContent(text, function () {
                toolbox.export({ ids: [], format: 'png' }, callback);
                utilsCallbacks.normalize(null, 'dir/');
                utilsCallbacks.testDir(null, 'dir/');
                expect(lib.iconizeSvg).not.toHaveBeenCalled();
                expect(lib.iconizePng.calls.argsFor(0)[0]).toBe('source');
                expect(lib.iconizePng.calls.argsFor(0)[1]).toEqual({
                    ids: [], format: 'png', exportOptions: {}
                });
                expect(typeof lib.iconizePng.calls.argsFor(0)[2]).toBe('function');
                libCallbacks.iconizePng(null);
                expect(callback).toHaveBeenCalled();
                expect(callback.calls.argsFor(0)[0]).toBeFalsy();
                done();
            });
        });

        it("reacts on iconizePng errors", function (done) {
            loadContent(text, function () {
                toolbox.export({ ids: [], format: 'png' }, callback);
                utilsCallbacks.normalize(null, 'dir/');
                utilsCallbacks.testDir(null, 'dir/');
                libCallbacks.iconizePng('err');
                expect(callback.calls.argsFor(0)[0]).toBeTruthy();
                done();
            });
        });

        it("calls iconizeSvg", function (done) {
            loadContent(text, function () {
                var opt = { ids: [], format: 'svg', exportOptions: {} };
                toolbox.export(opt, callback);
                utilsCallbacks.normalize(null, 'dir/');
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
                expect(callback).toHaveBeenCalled();
                expect(callback.calls.argsFor(0)[0]).toBeFalsy();
                done();
            });
        });

        it("calls iconizeSvg immediatly if no stylesheet is found", function (done) {
            text = '<?xml ?><svg></svg>';
            loadContent(text, function () {
                var opt = { ids: [], format: 'svg', exportOptions: {} };
                toolbox.export(opt, callback);
                utilsCallbacks.normalize(null, 'dir/');
                utilsCallbacks.testDir(null, 'dir/');
                expect(lib.iconizePng).not.toHaveBeenCalled();
                expect(toolbox.inline).not.toHaveBeenCalled();
                expect(lib.iconizeSvg.calls.argsFor(0)[0]).toBe('source');
                expect(typeof lib.iconizeSvg.calls.argsFor(0)[1]).toBe('function');
                expect(lib.iconizeSvg.calls.argsFor(0)[2]).toBe(opt);
                expect(typeof lib.iconizeSvg.calls.argsFor(0)[3]).toBe('function');
                libCallbacks.iconizeSvg(null);
                expect(callback).toHaveBeenCalled();
                expect(callback.calls.argsFor(0)[0]).toBeFalsy();
                done();
            });
        });

        it("reacts on inline errors", function (done) {
            loadContent(text, function () {
                toolbox.export({ ids: [], format: 'svg' }, callback);
                utilsCallbacks.normalize(null, 'dir/');
                utilsCallbacks.testDir(null, 'dir/');
                inlineCallback('err');
                expect(callback.calls.argsFor(0)[0]).toBeTruthy();
                done();
            });
        });

        it("reacts on iconizeSvg errors", function (done) {
            loadContent(text, function () {
                toolbox.export({ ids: [], format: 'svg' }, callback);
                utilsCallbacks.normalize(null, 'dir/');
                utilsCallbacks.testDir(null, 'dir/');
                inlineCallback(null);
                libCallbacks.iconizeSvg('err');
                expect(callback.calls.argsFor(0)[0]).toBeTruthy();
                done();
            });
        });
    });
});