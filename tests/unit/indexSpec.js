"use strict";

var SandboxedModule = require('sandboxed-module');
var isr = require('../lib/istanbul-reporter.js');
var async = require('async');
var cheerio = require('cheerio');
var path = require('path');

describe("module main", function () {
    var fs, utils, toolbox, callback, errorPrinter;
    var sourceFn = 'source';
    var fsCallbacks = {}, lib = {}, libCallbacks = {}, utilsCallbacks = {};

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

        it("inits the error printer", function () {
            toolbox.load(sourceFn, callback);
            expect(utils.errorPrinter).toHaveBeenCalledWith(callback);
        });

        it("loads file to cheerio object", function () {
            var text = '<?xml ?><svg/>';
            toolbox.load(sourceFn, callback);
            expect(cheerio.load).not.toHaveBeenCalled();
            expect(fs.readFile.calls.argsFor(0)[0]).toBe('source');
            expect(typeof fs.readFile.calls.argsFor(0)[1]).toBe('function');
            expect(cheerio.load).not.toHaveBeenCalled();
            fsCallbacks.read(null, new Buffer(text));
            expect(cheerio.load.calls.argsFor(0)[0]).toBe(text);
            expect(cheerio.load.calls.argsFor(0)[1].xmlMode).toBe(true);
            expect(callback).toHaveBeenCalled();
            expect(callback.calls.argsFor(0)[0]).toBeFalsy();
            expect(callback.calls.argsFor(0)[1].$.xml()).toBe(text);
            expect(callback.calls.argsFor(0)[1].sourceFn).toBe(sourceFn);
            expect(typeof callback.calls.argsFor(0)[1].stylize).toBe('function');
            expect(typeof callback.calls.argsFor(0)[1].inline).toBe('function');
            expect(typeof callback.calls.argsFor(0)[1].write).toBe('function');
            expect(typeof callback.calls.argsFor(0)[1].export).toBe('function');
        });

        it("reacts on normalize errors", function () {
            path.normalize.and.throwError('message');
            toolbox.load(sourceFn, callback);
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

    describe("function batch", function () {

        it("loads the source", function () {
            spyOn(toolbox, 'load').and.callFake(function (fn, cb) {
                cb(null, 'loaded');
            });
            toolbox.batch(sourceFn, [], callback);
            expect(toolbox.load.calls.argsFor(0)[0]).toBe(sourceFn);
            expect(typeof toolbox.load.calls.argsFor(0)[1]).toBe('function');
            expect(callback.calls.argsFor(0)[0]).toBeFalsy();
            expect(callback.calls.argsFor(0)[1]).toBe('loaded');
        });

        it("reacts on load errors", function () {
            spyOn(toolbox, 'load').and.callFake(function (fn, cb) {
                cb('err');
            });
            toolbox.batch(sourceFn, [], callback);
            expect(callback.calls.argsFor(0)[0]).toBe('err');
        });

        it("processes tasks in order", function (done) {
            var tasks = [
                { task: 'stylize', arg: 'arg1'},
                { task: 'inline', arg: 'arg2'},
                { task: 'write', arg: 'arg3'},
                { task: 'export', arg: 'arg4'}
            ];
            var calls = [];
            var loaded = {};
            ['stylize', 'inline', 'write', 'export'].forEach(function (task) {
                loaded[task] = function (arg, next) {
                    calls.push({task: task, arg: arg});
                    next();
                };
            });
            spyOn(toolbox, 'load').and.callFake(function (fn, cb) {
                cb(null, loaded);
            });
            callback.and.callFake(function (err, context) {
                expect(calls).toEqual(tasks);
                expect(err).toBeFalsy();
                expect(context).toBe(loaded);
                done();
            });
            toolbox.batch(sourceFn, tasks, callback);
        });
    });

    describe("Object Loaded", function () {
        var loaded;

        function loadContent(text, next) {
            toolbox.load(sourceFn, callback);
            fsCallbacks.read(null, new Buffer(text));
            fs.readFile.calls.reset();
            loaded = callback.calls.argsFor(0)[1];
            callback.calls.reset();
            utils.errorPrinter.calls.reset();
            next();
        }

        afterEach(function () {
            callback.calls.allArgs().forEach(function (args) {
                expect(typeof args[1].$).toBe('function');
                expect(args[1].sourceFn).toBe(sourceFn);
                expect(typeof args[1].stylize).toBe('function');
                expect(typeof args[1].inline).toBe('function');
                expect(typeof args[1].write).toBe('function');
                expect(typeof args[1].export).toBe('function');
            });
        });

        describe("function stylize", function () {
            var text;

            beforeEach(function () {
                text = '<?xml ?><svg><style/></svg>';
            });

            it("inits the error printer", function (done) {
                loadContent(text, function () {
                    loaded.stylize({}, callback);
                    expect(utils.errorPrinter).toHaveBeenCalledWith(callback, loaded);
                    done();
                 });
            });

            it("reacts on missing options", function (done) {
                loadContent(text, function () {
                    loaded.stylize(null, callback);
                    expect(utils.raiseErr).toHaveBeenCalledWith(
                        'No valid options.', null, errorPrinter
                    );
                    expect(callback).not.toHaveBeenCalled();
                    done();
                });
            });

            it("reacts on missing sources", function (done) {
                loadContent(text, function () {
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
                    done();
                });
            });

            it("reacts on collection error", function (done) {
                loadContent(text, function () {
                    loaded.stylize({ src: 'file.css' }, callback);
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
                    done();
                });
            });

            it("inserts multiple stylesheets", function (done) {
                loadContent(text, function () {
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
                    done();
                });
            });

            it("inserts stylesheet only into first def element", function (done) {
                text = '<?xml ?><svg><defs><use/></defs><defs/></svg>';
                loadContent(text, function () {
                    loaded.stylize({ src: 'file.css' }, callback);
                    libCallbacks.collect(null, ['rules1', 'rules2']);
                    loaded.write('fn', callback);
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

            it("inits the error printer", function (done) {
                loadContent(text, function () {
                    loaded.inline(null, callback);
                    expect(utils.errorPrinter).toHaveBeenCalledWith(callback, loaded);
                    done();
                 });
            });

            it("reacts on collection error", function (done) {
                loadContent(text, function () {
                    loaded.inline(null, callback);
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
                    loaded.inline(null, callback);
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
                    loaded.inline({src: 'file'}, callback);
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
                    loaded.stylize({ src: 'file.css' }, callback);
                    libCallbacks.collect(null, ['rules1']);
                    loaded.inline({src: 'file'}, callback);
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
                    loaded.inline(null, callback);
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

            it("inits the error printer", function (done) {
                loadContent(text, function () {
                    loaded.write('target', callback);
                    expect(utils.errorPrinter).toHaveBeenCalledWith(callback, loaded);
                    done();
                 });
            });

            it("reacts on normalize errors", function (done) {
                loadContent(text, function () {
                    path.normalize.and.throwError('message');
                    loaded.write('target', callback);
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
                    loaded.write('target', callback);
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
                    loaded.write('target', callback);
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
                    loaded.write(null, callback);
                    expect(path.normalize.calls.argsFor(0)[0]).toBe('source');
                    done();
            });
            });
        });

        describe("function export", function () {
            var text;

            beforeEach(function () {
                text = '<?xml ?><svg><style/></svg>';
            });

            it("inits the error printer", function (done) {
                loadContent(text, function () {
                    loaded.export(null, callback);
                    expect(utils.errorPrinter).toHaveBeenCalledWith(callback, loaded);
                    done();
                 });
            });

            it("reacts on missing options", function (done) {
                loadContent(text, function () {
                    loaded.export(null, callback);
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
                    done();
                });
            });

            it("reacts on normalize errors", function (done) {
                loadContent(text, function () {
                    path.normalize.and.throwError('message');
                    loaded.export({ ids: [] }, callback);
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
                    loaded.export({ ids: [] }, callback);
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
                    loaded.export({ ids: [] }, callback);
                    utilsCallbacks.testDir(null, 'dir/');
                    expect(lib.iconizePng).not.toHaveBeenCalled();
                    expect(lib.iconizeSvg).not.toHaveBeenCalled();
                    expect(utils.raiseErr).toHaveBeenCalledWith(
                        'No valid export format.', null, errorPrinter
                    );
                    expect(callback).not.toHaveBeenCalled();
                    utils.raiseErr.calls.reset();
                    loaded.export({ ids: [], format: 'txt' }, callback);
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
                    loaded.export({ ids: [], format: 'png' }, callback);
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
                    spyOn(loaded, 'inline');
                    var opt = { ids: [], format: 'svg', exportOptions: {} };
                    loaded.export(opt, callback);
                    utilsCallbacks.testDir(null, 'dir/');
                    expect(lib.iconizePng).not.toHaveBeenCalled();
                    expect(lib.iconizeSvg).not.toHaveBeenCalled();
                    expect(loaded.inline.calls.argsFor(0)[0]).toEqual({});
                    expect(typeof loaded.inline.calls.argsFor(0)[1]).toBe('function');
                    loaded.inline.calls.argsFor(0)[1](null);
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
                    spyOn(loaded, 'inline');
                    var opt = { ids: [], format: 'svg', exportOptions: {} };
                    loaded.export(opt, callback);
                    utilsCallbacks.testDir(null, 'dir/');
                    expect(lib.iconizePng).not.toHaveBeenCalled();
                    expect(loaded.inline).not.toHaveBeenCalled();
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
                    spyOn(loaded, 'inline');
                    loaded.export({ ids: [], format: 'svg' }, callback);
                    utilsCallbacks.testDir(null, 'dir/');
                    loaded.inline.calls.argsFor(0)[1]('err');
                    expect(errorPrinter.calls.argsFor(0)[0]).toBeTruthy();
                    done();
                });
            });

            it("reacts on iconizeSvg errors", function (done) {
                loadContent(text, function () {
                    spyOn(loaded, 'inline');
                    loaded.export({ ids: [], format: 'svg' }, callback);
                    utilsCallbacks.testDir(null, 'dir/');
                    loaded.inline.calls.argsFor(0)[1](null);
                    libCallbacks.iconizeSvg('err');
                    expect(errorPrinter.calls.argsFor(0)[0]).toBeTruthy();
                    done();
                });
            });
        });
    });
});