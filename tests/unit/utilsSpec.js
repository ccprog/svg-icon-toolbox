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

    describe("function computeTransform", function () {
        it("reacts on invalid parameters", function () {
            var matches = [
                {
                    args: [null, '10', null, 'none'],
                    result: 'error'
                },
                {
                    args: ['21', null, null,'none'],
                    result: 'error'
                }
            ];
            matches.forEach(function (match) {
                var func = function () {
                    return utils.computeTransform.apply(null, match.args);
                };
                expect(func).toThrow();
            });
        });

        it("computes a transform expression from incomplete parameters", function () {
            var matches = [
                {
                    args: ['21', null, '11 13 3 2', 'none'],
                    result: 'translate(-77 -13) scale(7 1)'
                },
                {
                    args: [null, '10', '11 13 3 2', 'none'],
                    result: 'translate(-11 -65) scale(1 5)'
                },
                {
                    args: ['21', '10', null, 'none'],
                    result: null
                },
                {
                    args: ['21','10', '11 13 3 2', null],
                    result: 'translate(-52 -65) scale(5 5)'
                }
            ];
            matches.forEach(function (match) {
                expect(utils.computeTransform.apply(null, match.args)).toBe(match.result);
            });
        });

        it("computes a simplified transform expression", function () {
            var matches = [
                {
                    args: ['21', '10', '11 13 3 2', 'none'],
                    result: 'translate(-77 -65) scale(7 5)'
                },
                {
                    args: ['3', '2', '11 13 3 2', 'none'],
                    result: 'translate(-11 -13)'
                },
                {
                    args: ['21', '10', '0 0 3 2', 'none'],
                    result: 'scale(7 5)'
                }
            ];
            matches.forEach(function (match) {
                expect(utils.computeTransform.apply(null, match.args)).toBe(match.result);
            });
        });

        it("computes a complete transform expression", function () {
            var numbers = ['21', '10', '11 13 3 2'];
            var matches = [
                {
                    args: numbers.concat('xMidYMid'),
                    result: 'translate(-52 -65) scale(5 5)'
                },
                {
                    args: numbers.concat('xMinYMin'),
                    result: 'translate(-55 -65) scale(5 5)'
                },
                {
                    args: numbers.concat('xMaxYMax meet'),
                    result: 'translate(-49 -65) scale(5 5)'
                },
                {
                    args: numbers.concat('xMinYMin slice'),
                    result: 'translate(-77 -91) scale(7 7)'
                },
                {
                    args: numbers.concat('xMidYMid slice'),
                    result: 'translate(-77 -93) scale(7 7)'
                },
                {
                    args: numbers.concat('xMaxYMax slice'),
                    result: 'translate(-77 -95) scale(7 7)'
                }
            ];
            matches.forEach(function (match) {
                expect(utils.computeTransform.apply(null, match.args)).toBe(match.result);
            });
        });
    });
});