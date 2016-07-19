"use strict";

var SandboxedModule = require('sandboxed-module');

describe("module spawn", function () {
    var EventEmitter = require('events');
    function Child () {
        var self = new EventEmitter();
        self.stdout = new EventEmitter();
        self.stdin = 'stdin';
        self.stderr = new EventEmitter();
        return self;
    }

    var child, cp, console, utils, spawn, callback;

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
        console = {
            log: jasmine.createSpy('log')
        };
        utils = {
            handleErr: jasmine.createSpy('handleErr')  
        };
        spawn = SandboxedModule.require('../../lib/spawn.js', {
            requires: { 'child_process': cp, './utils.js': utils },
            globals: { 'console': console }
        });

        callback = jasmine.createSpy('callback');
    });

    it("spawns a command and tracks its events", function () {
        var stream = spawn('command arg1 arg2', null, false, callback);
        expect(cp.spawn).toHaveBeenCalledWith('command', ['arg1', 'arg2']);
        expect(child.stdout.on.calls.argsFor(0)[0]).toBe('data');
        expect(typeof child.stdout.on.calls.argsFor(0)[1]).toBe('function');
        expect(child.on.calls.argsFor(0)[0]).toBe('exit');
        expect(typeof child.on.calls.argsFor(0)[1]).toBe('function');
        expect(child.stderr.on.calls.argsFor(0)[0]).toBe('data');
        expect(typeof child.stderr.on.calls.argsFor(0)[1]).toBe('function');
        expect(stream).toBe('stdin');
    });

    it("hands stdout line by line to console", function () {
        spawn('command', null, false, callback);
        [
            'first ',
            'line\nsecond line\n',
            'third ',
            'line'
        ].forEach(function (item) {
            child.stdout.emit('data', new Buffer(item));
        });
        child.emit('exit', 0);
        expect(console.log.calls.count()).toBe(3);
        expect(console.log.calls.argsFor(0)[0]).toBe('first line');
        expect(console.log.calls.argsFor(1)[0]).toBe('second line');
        expect(console.log.calls.argsFor(2)[0]).toBe('third line');
        expect(callback).toHaveBeenCalledWith(null, 0);
    });

    it("calls a supplied lineFn per line", function () {
        var lineFn = jasmine.createSpy('lineFn');
        spawn('command', lineFn, false, callback);
        [
            'first ',
            'line\nsecond line'
        ].forEach(function (item) {
            child.stdout.emit('data', new Buffer(item));
        });
        child.emit('exit', 0);
        expect(console.log).not.toHaveBeenCalled();
        expect(lineFn.calls.count()).toBe(2);
        expect(lineFn.calls.argsFor(0)[0]).toBe('first line');
        expect(lineFn.calls.argsFor(1)[0]).toBe('second line');
        expect(callback).toHaveBeenCalledWith(null, 0);
    });

    it("delegates error handling", function () {
        spawn('command', null, false, callback);
        child.stderr.emit('data', new Buffer('message'));
        expect(utils.handleErr).toHaveBeenCalledWith('message', 'command', callback);
        expect(callback).not.toHaveBeenCalled();
    });

    it("calls the callback of a spawn with delay", function () {
        var callback1 = callback;
        spawn('command', null, true, callback1);
        var child1 = child;
        var callback2 = jasmine.createSpy('callback2');
        spawn('command', null, false, callback2);
        var child2 = child;
        child1.emit('exit', 1);
        expect(callback1).not.toHaveBeenCalled();
        child2.emit('exit', 0);
        expect(callback2).not.toHaveBeenCalled();
        expect(callback1).toHaveBeenCalledWith(null, 0);
        var callback3 = jasmine.createSpy('callback3');
        spawn('command', null, false, callback3);
        var child3 = child;
        var callback4 = jasmine.createSpy('callback4');
        spawn('command', null, false, callback4);
        var child4 = child;
        child4.emit('exit', 0);
        expect(callback4).toHaveBeenCalledWith(null, 0);
        expect(callback3).not.toHaveBeenCalled();
    });
});