"use strict";

var async = require('async');
var SandboxedModule = require('sandboxed-module');
var isr = require('../lib/istanbul-reporter.js');

describe("module spawn", function () {
    var EventEmitter = require('events');
    function Child () {
        var self = new EventEmitter();
        self.stdout = new EventEmitter();
        self.stdin = 'stdin';
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

    it("spawns a command and tracks its events", function (done) {
        spawn('command arg1 arg2', null, false, callback, function (err, stream) {
            expect(cp.spawn).toHaveBeenCalledWith('command', ['arg1', 'arg2']);
            expect(child.stdout.on.calls.argsFor(0)[0]).toBe('data');
            expect(typeof child.stdout.on.calls.argsFor(0)[1]).toBe('function');
            expect(child.on.calls.argsFor(0)[0]).toBe('exit');
            expect(typeof child.on.calls.argsFor(0)[1]).toBe('function');
            expect(child.stderr.on.calls.argsFor(0)[0]).toBe('data');
            expect(typeof child.stderr.on.calls.argsFor(0)[1]).toBe('function');
            expect(stream).toBe('stdin');
            done();
        });
        expect(which.calls.argsFor(0)[0]).toBe('command');
        expect(typeof which.calls.argsFor(0)[1]).toBe('function');
        whichCallback(null, 'command');
    });

    it("reacts on which errors", function () {
        var spawnCallback = jasmine.createSpy('spawnCallback');
        spawn('command arg1 arg2', null, false, callback, spawnCallback);
        whichCallback('message');
        expect(utils.raiseErr).toHaveBeenCalledWith('message', 'System', callback);
        expect(spawnCallback).not.toHaveBeenCalled();
    });

    it("hands stdout line by line to console", function (done) {
        spawn('command', null, false, callback, function () {
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
            done();
        });
        whichCallback(null, 'command');
    });

    it("calls a supplied lineFn per line", function (done) {
        var lineFn = jasmine.createSpy('lineFn');
        spawn('command', lineFn, false, callback, function () {
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
            done();
        });
        whichCallback(null, 'command');
    });

    it("delegates error handling", function (done) {
        spawn('command', null, false, callback, function () {
            child.stderr.emit('data', new Buffer('message'));
            expect(utils.raiseErr).toHaveBeenCalledWith('message', 'command', callback);
            expect(callback).not.toHaveBeenCalled();
            done();
        });
        whichCallback(null, 'command');
    });

    it("calls the callback of a spawn with delay", function (done) {
        var callbacks = [
            callback,
            jasmine.createSpy('callback1'),
            jasmine.createSpy('callback2'),
            jasmine.createSpy('callback3')
        ];
        var childs = [];
        async.eachOfSeries(callbacks, function (cb, idx, next) {
            spawn('command', null, idx === 0, cb, function () {
                childs[idx] = child;
                switch(idx) {
                case 1:
                    childs[0].emit('exit', 1);
                    expect(callbacks[0]).not.toHaveBeenCalled();
                    childs[1].emit('exit', 0);
                    expect(callbacks[1]).not.toHaveBeenCalled();
                    expect(callbacks[0]).toHaveBeenCalledWith(null, 0);
                    break;
                case 3:
                    childs[3].emit('exit', 0);
                    expect(callbacks[3]).toHaveBeenCalledWith(null, 0);
                    expect(callbacks[2]).not.toHaveBeenCalled();
                    done();
                    break;
                }
            });
            whichCallback(null, 'command');
            next();
        }, function (err) {
            if (err) throw err;
        });
    });
});