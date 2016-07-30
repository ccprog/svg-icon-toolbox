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

    describe("function raiseErr", function () {
        it("produces a well-formed error", function (done) {
            utils.raiseErr('message', 'command', function (err) {
                expect(err instanceof Error).toBe(true);
                expect(err.toolbox).toBe('command');
                expect(err.message).toBe('message');
                done();
            });
        });

        it("enhances existing Errors", function (done) {
            utils.raiseErr(new Error('message'), 'command', function (err) {
                expect(err instanceof Error).toBe(true);
                expect(err.toolbox).toBe('command');
                expect(err.message).toBe('message');
                done();
            });
        });

        it("does not overwrite previous header lines", function (done) {
            var err = new Error('message');
            err.toolbox = 'command1';
            utils.raiseErr(err, 'command2', function (err) {
                expect(err instanceof Error).toBe(true);
                expect(err.toolbox).toBe('command1');
                expect(err.message).toBe('message');
                done();
            });
        });
    });

    describe("function errorPrinter", function () {
        var self = 'self';

        it("prints errors to console", function () {
            var callback = jasmine.createSpy('callback');
            var err = new Error('message');
            err.toolbox = 'command';
            utils.errorPrinter(callback, self)(err);
            expect(console.error).toHaveBeenCalledWith('Error in command:\n  message');
            expect(callback.calls.argsFor(0)[0]).toBeTruthy();
            expect(callback.calls.argsFor(0)[1]).toBe(self);
        });

        it("exchanges module name for missing command", function () {
            var callback = jasmine.createSpy('callback');
            var err = new Error('message');
            err.toolbox = null;
            utils.errorPrinter(callback, self)(err);
            expect(console.error).toHaveBeenCalledWith('Error in svg-icon-toolbox:\n  message');
            expect(callback.calls.argsFor(0)[0]).toBeTruthy();
            expect(callback.calls.argsFor(0)[1]).toBe(self);
        });

        it("bypasses without error", function () {
            var callback = jasmine.createSpy('callback');
            utils.errorPrinter(callback, self)();
            expect(console.error).not.toHaveBeenCalled();
            expect(callback.calls.argsFor(0)[0]).toBeFalsy();
            expect(callback.calls.argsFor(0)[1]).toBe(self);
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

    describe("function computeTransform", function () {
        it("reacts on invalid parameters", function () {
            var matches = [
                [null, '10', null, 'none'],
                ['21', null, null,'none'],
                [null, '10mm', '11 13 3 2', 'none'],
                ['21em', null, '11 13 3 2','none'],
                ['21pt', '10pt', null,'none'],
                ['21', '0', '11 13 3 2','none'],
                ['0', '10', '11 13 3 2','none'],
                ['21', '10', '11 13 3 0','none'],
                ['21', '10', '11 13 0 2','none']
            ];
            matches.forEach(function (args) {
                var func = function () {
                    return utils.computeTransform.apply(null, args);
                };
                expect(func).toThrow();
            });
        });

        it("computes a transform expression from incomplete parameters", function () {
            var matches = [
                {
                    args: ['21', null, '11 13 3 2', 'none'],
                    result: ['translate(-77 -13)', 'scale(7 1)']
                },
                {
                    args: [null, '10', '11 13 3 2', 'none'],
                    result: ['translate(-11 -65)', 'scale(1 5)']
                },
                {
                    args: ['21', '10', null, 'none'],
                    result: []
                },
                {
                    args: ['21','10', '11 13 3 2', null],
                    result: ['translate(-52 -65)', 'scale(5 5)']
                }
            ];
            matches.forEach(function (match) {
                expect(utils.computeTransform.apply(null, match.args)).toEqual(match.result);
            });
        });

        it("computes a transform expression from percentages", function () {
            var matches = [
                {
                    args: ['50%', '2', '11 13 3 2', 'none'],
                    result: ['translate(-5.5 -13)', 'scale(0.5 1)']
                },
                {
                    args: ['150%', '100%', '11 13 3 2', 'none'],
                    result: ['translate(-16.5 -13)', 'scale(1.5 1)']
                }
            ];
            matches.forEach(function (match) {
                expect(utils.computeTransform.apply(null, match.args)).toEqual(match.result);
            });
        });

        it("computes a simplified transform expression", function () {
            var matches = [
                {
                    args: ['21', '10', '11 13 3 2', 'none'],
                    result: ['translate(-77 -65)', 'scale(7 5)']
                },
                {
                    args: ['3', '2', '11 13 3 2', 'none'],
                    result: ['translate(-11 -13)']
                },
                {
                    args: ['21', '10', '0 0 3 2', 'none'],
                    result: ['scale(7 5)']
                },
                {
                    args: ['3', '2', '0 0 3 2', 'none'],
                    result: []
                }
            ];
            matches.forEach(function (match) {
                expect(utils.computeTransform.apply(null, match.args)).toEqual(match.result);
            });
        });

        it("computes a complete transform expression", function () {
            var numbers = ['21', '10', '11 13 3 2'];
            var matches = [
                {
                    args: numbers.concat('xMidYMid'),
                    result: ['translate(-52 -65)', 'scale(5 5)']
                },
                {
                    args: numbers.concat('xMinYMin'),
                    result: ['translate(-55 -65)', 'scale(5 5)']
                },
                {
                    args: numbers.concat('xMaxYMax meet'),
                    result: ['translate(-49 -65)', 'scale(5 5)']
                },
                {
                    args: numbers.concat('xMinYMin slice'),
                    result: ['translate(-77 -91)', 'scale(7 7)']
                },
                {
                    args: numbers.concat('xMidYMid slice'),
                    result: ['translate(-77 -93)', 'scale(7 7)']
                },
                {
                    args: numbers.concat('xMaxYMax slice'),
                    result: ['translate(-77 -95)', 'scale(7 7)']
                }
            ];
            matches.forEach(function (match) {
                expect(utils.computeTransform.apply(null, match.args)).toEqual(match.result);
            });
        });
    });
});