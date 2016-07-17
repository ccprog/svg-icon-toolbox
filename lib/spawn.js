"use strict";

var spawn = require('child_process').spawn;

var utils = require('./utils.js');

var cmdCounter = {
    commands: [],
    add: function (callback) {
        this.commands.push(callback);
    },
    subtract: function (callback, code) {
        this.commands.splice(this.commands.indexOf(callback), 1);
        if (this.delay) {
            if (this.commands.length === 0) {
                //earmarked callback
                this.callback(null, code);
                this.delay = false;
            }
        } else {
            //current callback
            callback(null, code);
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
module.exports = function (cmd, lineFn, delay, callback) {
    var line = '';
    if (delay) {
        cmdCounter.delay = true;
        //earmark: only this callback gets executed
        cmdCounter.callback = callback;
    }
    cmdCounter.add(callback);
    var args = cmd.split(' ');
    var child = spawn(args.shift(), args);

    child.stdout.on('data', (data) => {
        var lines = data.toString().split('\n');
        lines[0] = line + lines[0];
        line = lines.pop();
        lines.forEach(lineFn || console.log);
    });

    child.on('exit', (code) => {
        if (line.length) {
            if (lineFn) {
                lineFn(line);
            } else {
                console.log(line);
            }
        }
        cmdCounter.subtract(callback, code);
    });

    child.stderr.on('data', (err) => {
        utils.handleErr(err.toString(), cmd, callback);
    });

    return child.stdin;
};
