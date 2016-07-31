"use strict";

var SandboxedModule = require('sandboxed-module');
var isr = require('../lib/istanbul-reporter.js');
var async = require('async');
var cheerio = require('cheerio');
var path = require('path');

describe("module main", function () {
    var fs, utils, toolbox, callback, errorPrinter;
    var Loaded, sourceFn = 'source';

    beforeEach(function () {
        spyOn(path, 'normalize').and.callThrough();
        fs = {
            readFile: jasmine.createSpy('readFile')
        };
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
        Loaded = function ($, sourceFn) {
            this.$ = $;
            this.sourceFn = sourceFn;
        };
        toolbox = SandboxedModule.require('../../index.js', {
            requires: {
                'async': async, 'cheerio': cheerio, 'fs': fs, 'path': path,
                './lib/utils.js': utils,
                './lib/Loaded.js': Loaded
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
            fs.readFile.calls.argsFor(0)[1](null, new Buffer(text));
            expect(cheerio.load.calls.argsFor(0)[0]).toBe(text);
            expect(cheerio.load.calls.argsFor(0)[1].xmlMode).toBe(true);
            expect(callback).toHaveBeenCalled();
            expect(callback.calls.argsFor(0)[0]).toBeFalsy();
            expect(callback.calls.argsFor(0)[1] instanceof Loaded).toBe(true);
            expect(callback.calls.argsFor(0)[1].$.xml()).toBe(text);
            expect(callback.calls.argsFor(0)[1].sourceFn).toBe(sourceFn);
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
            fs.readFile.calls.argsFor(0)[1]('message');
            expect(cheerio.load).not.toHaveBeenCalled();
            expect(utils.raiseErr).toHaveBeenCalledWith(
                'message', 'file I/O', errorPrinter
            );
            expect(callback).not.toHaveBeenCalled();
        });

        it("reacts on invalid content", function () {
            toolbox.load('source', callback);
            fs.readFile.calls.argsFor(0)[1](null, new Buffer('random'));
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
});