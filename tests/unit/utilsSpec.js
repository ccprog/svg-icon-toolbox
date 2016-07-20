"use strict";

var SandboxedModule = require('sandboxed-module');
var isr = require('../lib/istanbul-reporter.js');

describe("module utils", function () {
    var path, cp, console, utils, callback;

    beforeEach(function () {
        path = {
            normalize: jasmine.createSpy('normalize') 
        };
        cp = {
            execSync: jasmine.createSpy('execSync')
        };
        console = {
            error: jasmine.createSpy('error')
        };
        utils = SandboxedModule.require('../../lib/utils.js', {
            requires: { 'path': path, 'child_process': cp },
            globals: { 'console': console },
            sourceTransformers: {
                istanbul: isr.transformer
            }
        });
        callback = jasmine.createSpy('callback');
    });

    describe("function handleErr", function () {
        it("prints errors to console", function () {
            var answ = utils.handleErr('message', 'command', callback);
            expect(console.error).toHaveBeenCalledWith('Error in command:\n  %s', 'message');
            expect(callback.calls.argsFor(0)[0]).toBeTruthy();
            expect(answ).toBeUndefined();
        });

        it("exchanges module name for missing command", function () {
            utils.handleErr('message', null, callback);
            expect(console.error).toHaveBeenCalledWith('Error in svg-icon-toolbox:\n  %s', 'message');
            expect(callback.calls.argsFor(0)[0]).toBeTruthy();
        });

        it("returns directly without callback", function () {
            var answ = utils.handleErr('message', 'command');
            expect(callback).not.toHaveBeenCalled();
            expect(answ).toBeTruthy();
        });
    });

    describe("function normalize", function () {
        it("wraps path.normalize", function () {
            path.normalize.and.returnValue('normal');
            utils.normalize('name', callback);
            expect(path.normalize).toHaveBeenCalledWith('name');
            expect(callback).toHaveBeenCalledWith(null, 'normal');
        });
 
        it("returns error to callback", function () {
            path.normalize.and.throwError('message');
            utils.normalize('name', callback);
            expect(callback).toHaveBeenCalledWith('message');
        });
    });

    describe("function testDir", function () {
        it("calls child process with supplied directory name", function () {
            utils.testDir('direc/tory', callback);
            expect(cp.execSync).toHaveBeenCalledWith('mkdir -p direc/tory');
            expect(callback).toHaveBeenCalledWith(null);
        });

        it("returns error to callback", function () {
            cp.execSync.and.throwError('message');
            utils.testDir('direc/tory', callback);
            expect(callback).toHaveBeenCalledWith('message');
        });
    });
});