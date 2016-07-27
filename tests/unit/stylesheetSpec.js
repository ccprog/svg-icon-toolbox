"use strict";

var SandboxedModule = require('sandboxed-module');
var isr = require('../lib/istanbul-reporter.js');
var async = require('async');
var path = require('path');

describe("module stylesheet, function collect", function () {
    var css, sass, fs, console, utils, stylesheet, callback;
    var sassCallback, fileCallbacks;
    var sassOptions;

    function loadCollect (src) {
        stylesheet.collect({ src: src, sassOptions: sassOptions}, callback);
    }

    beforeEach(function () {
        css = {
            parse: jasmine.createSpy('parse')
        };
        sass = {
            render: function (source, callback) {
                sassCallback = callback;
            }
        };
        spyOn(sass, 'render').and.callThrough();
        fs = {
            readFile: function (fn, callback) {
                fileCallbacks[fn] = callback;
            }
        };
        spyOn(fs, 'readFile').and.callThrough();
        spyOn(path, 'normalize').and.callThrough();
        spyOn(path, 'dirname').and.callThrough();
        spyOn(path, 'extname').and.callThrough();
        console = { log: () => {} };
        fileCallbacks = {};
        utils = {
            raiseErr: jasmine.createSpy('raiseErr')  
        };
        stylesheet = SandboxedModule.require('../../lib/stylesheet.js', {
            requires: { 'async': async, 'css': css, 'node-sass': sass, 'fs': fs,
                    'path': path, './utils.js': utils },
            globals: { 'console': console },
            sourceTransformers: {
                suppressStdOut: function (source) {
                    return source.replace(/process\.stdout\.write/g, 'console.log');
                },
                istanbul: isr.transformer
            }
        });

        callback = jasmine.createSpy('callback');
        sassOptions = undefined;
    });

    it("returns silently without source", function () {
        loadCollect([]);
        expect(callback.calls.argsFor(0)).toEqual([null, []]);
        callback.calls.reset();
        loadCollect(null);
        expect(callback.calls.argsFor(0)).toEqual([null, []]);
    });

    it("reacts on normalize errors", function () {
        path.normalize.and.throwError('message');
        loadCollect('./file');
        expect(utils.raiseErr.calls.argsFor(0)[0].message).toBe('message');
        expect(utils.raiseErr.calls.argsFor(0)[1]).toBe('file I/O');
        expect(typeof utils.raiseErr.calls.argsFor(0)[2]).toBe('function');
        expect(utils.raiseErr.calls.argsFor(0)[2]).not.toBe(callback);
    });

    it("reads css file", function () {
        loadCollect('file.css');
        expect(fs.readFile.calls.argsFor(0)[0]).toBe('file.css');
        expect(typeof fs.readFile.calls.argsFor(0)[1]).toBe('function');
        fileCallbacks['file.css'](null, 'content');
        expect(path.extname).toHaveBeenCalledWith('file.css');
        expect(css.parse).toHaveBeenCalledWith('content');
        expect(callback.calls.argsFor(0)).toEqual([null, ['content']]);
    });

    it("reads multiple css file", function () {
        loadCollect(['file1.css', 'file2.css']);
        expect(fs.readFile.calls.argsFor(0)[0]).toBe('file1.css');
        fileCallbacks['file1.css'](null, 'content1');
        expect(css.parse).toHaveBeenCalledWith('content1');
        expect(fs.readFile.calls.argsFor(1)[0]).toBe('file2.css');
        fileCallbacks['file2.css'](null, 'content2');
        expect(css.parse).toHaveBeenCalledWith('content2');
        expect(callback.calls.argsFor(0)).toEqual([null, ['content1', 'content2']]);
    });

    it("reacts on css parse error", function () {
        loadCollect('file.css');
        expect(fs.readFile.calls.argsFor(0)[0]).toBe('file.css');
        css.parse.and.throwError('message');
        fileCallbacks['file.css'](null, 'content');
        expect(utils.raiseErr.calls.argsFor(0)[0].message).toBe('message');
        expect(utils.raiseErr.calls.argsFor(0)[1]).toBe('CSS file file.css');
        expect(typeof utils.raiseErr.calls.argsFor(0)[2]).toBe('function');
        expect(utils.raiseErr.calls.argsFor(0)[2]).not.toBe(callback);
    });

    it("reads sass file", function () {
        loadCollect('file.scss');
        expect(fs.readFile.calls.argsFor(0)[0]).toBe('file.scss');
        expect(typeof fs.readFile.calls.argsFor(0)[1]).toBe('function');
        fileCallbacks['file.scss'](null, 'content');
        expect(path.extname).toHaveBeenCalledWith('file.scss');
        expect(path.dirname).toHaveBeenCalledWith('file.scss');
        expect(sass.render.calls.argsFor(0)[0]).toEqual({
            file: null,
            includePaths: ['.'],
            sourceMap: false,
            data: 'content'
        });
        expect(typeof sass.render.calls.argsFor(0)[1]).toBe('function');
        sassCallback(null, { css: new Buffer('compiled') });
        expect(callback.calls.argsFor(0)).toEqual([null, ['compiled']]);
    });

    it("reads sass options", function () {
        sassOptions = {
            file: 'file',
            includePaths: ['dir/'],
            sourceMap: true,
            data: 'fakeContent',
            random: 'random'
        };
        loadCollect('file.scss');
        fileCallbacks['file.scss'](null, 'content');
        expect(sass.render.calls.argsFor(0)[0]).toEqual({
            file: null,
            includePaths: ['dir/'],
            sourceMap: false,
            data: 'content',
            random: 'random'
        });
    });

    it("reads multiple sass file", function () {
        loadCollect(['file1.scss', 'file2.scss']);
        expect(fs.readFile.calls.argsFor(0)[0]).toBe('file1.scss');
        fileCallbacks['file1.scss'](null, 'content1');
        expect(path.extname).toHaveBeenCalledWith('file1.scss');
        expect(path.dirname).toHaveBeenCalledWith('file1.scss');
        sassCallback(null, { css: new Buffer('compiled1') });
        expect(fs.readFile.calls.argsFor(1)[0]).toBe('file2.scss');
        fileCallbacks['file2.scss'](null, 'content2');
        expect(path.extname).toHaveBeenCalledWith('file2.scss');
        expect(path.dirname).toHaveBeenCalledWith('file2.scss');
        sassCallback(null, { css: new Buffer('compiled2') });
        expect(callback.calls.argsFor(0)).toEqual([null, ['compiled1', 'compiled2']]);
    });

    it("reacts on sass parse error", function () {
        loadCollect('file.scss');
        expect(fs.readFile.calls.argsFor(0)[0]).toBe('file.scss');
        fileCallbacks['file.scss'](null, 'content');
        sassCallback({ line: 3, column: 4, message: 'message' });
        expect(utils.raiseErr.calls.argsFor(0)[0]).toBe('message');
        expect(utils.raiseErr.calls.argsFor(0)[1]).toBe('SCSS file file.scss, line 3, column 4');
        expect(typeof utils.raiseErr.calls.argsFor(0)[2]).toBe('function');
        expect(utils.raiseErr.calls.argsFor(0)[2]).not.toBe(callback);
    });

    it("reacts on unrecognized file extension", function () {
        loadCollect('file.ext');
        expect(fs.readFile.calls.argsFor(0)[0]).toBe('file.ext');
        fileCallbacks['file.ext'](null, 'content');
        expect(utils.raiseErr.calls.argsFor(0)[0]).toBe('no recognized file format');
        expect(utils.raiseErr.calls.argsFor(0)[1]).toBe(null);
        expect(typeof utils.raiseErr.calls.argsFor(0)[2]).toBe('function');
        expect(utils.raiseErr.calls.argsFor(0)[2]).not.toBe(callback);
    });
});