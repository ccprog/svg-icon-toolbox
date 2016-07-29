"use strict";

var SandboxedModule = require('sandboxed-module');
var isr = require('../lib/istanbul-reporter.js');

describe("module spawn", function () {
    var EventEmitter = require('events');
    function Child () {
        var self = new EventEmitter();
        self.stdout = new EventEmitter();
        self.stdin = {
            write: jasmine.createSpy('write')
        };
        self.stderr = new EventEmitter();
        return self;
    }

    var child, cp, which, console, utils, spawn, callback;
    var whichCallback;

    beforeEach(function () {
        cp = {
            spawn: function () {
                child = new Child();
                spyOn(child.stdout, 'on').and.callThrough();
                spyOn(child.stderr, 'on').and.callThrough();
                spyOn(child, 'on').and.callThrough();
                return child;
            }
        };
        spyOn(cp, 'spawn').and.callThrough();
        which = jasmine.createSpy('which').and.callFake(function (cmd, callback) {
            whichCallback = callback;
        });
        console = {
            log: jasmine.createSpy('log')
        };
        utils = {
            raiseErr: jasmine.createSpy('raiseErr')  
        };
        spawn = SandboxedModule.require('../../lib/spawn.js', {
            requires: { 'child_process': cp, 'which': which, './utils.js': utils },
            globals: { 'console': console },
            sourceTransformers: {
                istanbul: isr.transformer
            }
        });

        callback = jasmine.createSpy('callback');
    });

    it("spawns a command and tracks its events", function () {
        spawn('command arg1 arg2', false, callback);
        expect(which.calls.argsFor(0)[0]).toBe('command');
        expect(typeof which.calls.argsFor(0)[1]).toBe('function');
        whichCallback(null, 'command');
        expect(cp.spawn).toHaveBeenCalledWith('command', ['arg1', 'arg2']);
        expect(child.stdout.on.calls.argsFor(0)[0]).toBe('data');
        expect(typeof child.stdout.on.calls.argsFor(0)[1]).toBe('function');
        expect(child.on.calls.argsFor(0)[0]).toBe('exit');
        expect(typeof child.on.calls.argsFor(0)[1]).toBe('function');
        expect(child.stderr.on.calls.argsFor(0)[0]).toBe('data');
        expect(typeof child.stderr.on.calls.argsFor(0)[1]).toBe('function');
        expect(callback).not.toHaveBeenCalled();
        child.emit('exit', 0);
        expect(callback.calls.argsFor(0)[0]).toBe(null);
        expect(callback.calls.argsFor(0)[1]).toEqual([]);
    });

    it("reacts on which errors", function () {
        spawn('command arg1 arg2', false, callback);
        whichCallback('message');
        expect(utils.raiseErr).toHaveBeenCalledWith('message', 'System', callback);
        expect(callback).not.toHaveBeenCalled();
    });

    it("reacts on command errors", function () {
        spawn('command', false, callback);
        whichCallback(null, 'command');
        child.stderr.emit('data', new Buffer('message'));
        expect(utils.raiseErr).toHaveBeenCalledWith('message', 'command', callback);
        expect(callback).not.toHaveBeenCalled();
    });

    it("hands stdout line by line to callback", function () {
        spawn('command', false, callback);
        whichCallback(null, 'command');
        [
            'first ',
            'line\nsecond line\n',
            'third ',
            'line'
        ].forEach(function (item) {
            child.stdout.emit('data', new Buffer(item));
        });
        child.emit('exit', 0);
        expect(callback.calls.argsFor(0)[0]).toBe(null);
        expect(callback.calls.argsFor(0)[1]).toEqual([
            'first line',
            'second line',
            'third line'
        ]);
    });

    it("filters stdout for a shell command", function () {
        var lineFn1 = jasmine.createSpy('lineFn1');
        var lineFn2 = jasmine.createSpy('lineFn2');
        spawn('command', true, callback);
        whichCallback(null, 'command');
        expect(callback.calls.argsFor(0)[0]).toBe(null);
        expect(typeof callback.calls.argsFor(0)[1]).toBe('function');
        var shell = callback.calls.argsFor(0)[1];
        shell('question1', /my (.*)/, lineFn1);
        expect(child.stdin.write).toHaveBeenCalledWith('question1', 'utf8');
        shell('question2', /your (.*)/, lineFn2);
        expect(child.stdin.write).toHaveBeenCalledWith('question2', 'utf8');
        child.stdout.emit('data', new Buffer('any answer\n'));
        expect(lineFn1).not.toHaveBeenCalled();
        expect(lineFn2).not.toHaveBeenCalled();
        child.stdout.emit('data', new Buffer('your answer\n'));
        expect(lineFn1).not.toHaveBeenCalled();
        expect(lineFn2).toHaveBeenCalledWith(null, 'answer');
        child.stdout.emit('data', new Buffer('my answer'));
        child.emit('exit', 0);
        expect(lineFn1).toHaveBeenCalledWith(null, 'answer');
        expect(callback.calls.count()).toBe(1);
    });

    it("calls on exit for shell without regex", function () {
        var leaveFn = jasmine.createSpy('leaveFn');
        spawn('command', true, callback);
        whichCallback(null, 'command');
        var shell = callback.calls.argsFor(0)[1];
        shell('quit', null, leaveFn);
        child.stdout.emit('data', new Buffer('my answer\n'));
        expect(leaveFn).not.toHaveBeenCalled();
        child.emit('exit', 0);
        expect(leaveFn).toHaveBeenCalledWith(null);
    });

    it("reacts on command errors in shell mode", function () {
        spawn('command', true, callback);
        whichCallback(null, 'command');
        child.stderr.emit('data', new Buffer('message'));
        expect(utils.raiseErr).toHaveBeenCalledWith('message', 'command', callback);
        var lineFn1 = jasmine.createSpy('lineFn1');
        var lineFn2 = jasmine.createSpy('lineFn2');
        var shell = callback.calls.argsFor(0)[1];
        shell('question1', /my (.*)/, lineFn1);
        shell('question2', /your (.*)/, lineFn2);
        child.stderr.emit('data', new Buffer('message'));
        expect(utils.raiseErr).toHaveBeenCalledWith('message', 'question1', lineFn1);
        expect(lineFn1).not.toHaveBeenCalled();
        expect(lineFn2).not.toHaveBeenCalled();
    });
});