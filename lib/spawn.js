"use strict";

var spawn = require('child_process').spawn;

var utils = require('./utils.js');

var cmdCounter = {
    commands: [],
    add: function (cmd) {
        this.commands.push(cmd);
    },
    subtract: function (cmd, code) {
        this.commands.splice(this.commands.indexOf(cmd), 1);
        if (this.delay && this.commands.length === 0) {
            this.callback(code);
        }
    }
};

/**
 *  spawns a command and handles std streams
 * 
 * @param {string} cmd command to spawns
 * @param {function (string): void} lineFn function handling stdout on a line basis
 * @param {function (number): void} endFn function called on command exit
 * @param {boolean} [delay=false] call callback if no more commands are currently
 * executed
 * @param {function (any): void} callback
 */
module.exports = function (cmd, lineFn, endFn, delay, callback) {
    var line = '';
    cmdCounter.callback = callback;
    if (delay) cmdCounter.delay = delay;
    cmdCounter.add(cmd);
    var args = cmd.split(' ');
    var child = spawn(args.shift(), args);

    child.stdout.on('data', function handleOut (data) {
        var lines = data.toString().split('\n');
        lines[0] = line + lines[0];
        line = lines.pop();
        lines.forEach(lineFn || console.log);
    });

    child.on('close', (code) => {
        if (line.length && lineFn) {
            lineFn(line);
        }
        if (endFn) {
            endFn();
        }
        cmdCounter.subtract(cmd, code);
    });

    child.stderr.on('data', (err) => {
        utils.handleErr(err.toString(), cmd, cmdCounter.callback);
    });

    return child.stdin;
};
