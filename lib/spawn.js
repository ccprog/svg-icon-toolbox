"use strict";

var which = require('which');
var spawn = require('child_process').spawn;

var utils = require('./utils.js');

/**
 *  spawns a command and handles std streams
 * 
 * @param {string} cmd command to spawns
 * @param {boolean} shell Shell mode will implement a sort of REPL
 * @param {function (any): void} callback
 * - with shell=false, called on process exit with (err, out) where out is
 *   an array containing all lines written by the command to stdout.
 * - with schell=true, called with (err, shell) where shell is a function to
 *   write to stdin. It has the signature (command, regex, callback) with
 *   command written to stdin, regex an optional RegEx to filter out the
 *   relevant information (the content of the first catching paranthesis)
 *   from stdout. The callback is called with (err, content). If no regex is
 *   supplied, the callbeck will be called on process exit with (err).
 */
module.exports = function (cmd, shell, cmdCallback) {
    var args = cmd.split(' ');
    // verify command existence
    which(args.shift(), (err, exec) => {
        if (err) return utils.raiseErr(err, 'System', cmdCallback);

        var leaveCallback;
        var interesting = [], line = '', lineCache = [];

        // spawn process
        var child = spawn(exec, args);

        // filter stdout lines for interesting content
        function filter (line) {
            // look at all pending stdin commands
            interesting.forEach((interest, idx) => {
                var filtered = interest.regex.exec(line);
                if (filtered && filtered[1]) {
                    delete interesting[idx];
                    interest.callback(null, filtered[1]);
                }
            });
        }

        child.stdout.on('data', (data) => {
            var lines = data.toString().split('\n');
            lines[0] = line + lines[0];
            line = lines.pop();
            if (shell) {
                 lines.forEach(filter);
            } else {
                 lineCache = lineCache.concat(lines);
            }
        });

        child.on('exit', () => {
            if (shell) {
                 if (line.length) filter(line);
                 // special "quit" callback
                 if (leaveCallback) leaveCallback(null);
            } else {
                 if (line.length) lineCache.push(line);
                 // main callback gets all stdout content
                 cmdCallback(null, lineCache);
            }
        });

        child.stderr.on('data', (err) => {
            if (shell && interesting.length) {
                // using the oldest stdin command is the best guess
                utils.raiseErr(
                    err.toString(),
                    interesting[0].command,
                    interesting[0].callback
                );
            } else {
                utils.raiseErr(err.toString(), cmd, cmdCallback);
            }
        });

        // REPL loop
        function write (command, regex, callback) {
            if (regex) {
                interesting.push({
                    command: command,
                    callback: callback,
                    regex: regex
                });
            } else {
                // for a "quit" command
                leaveCallback = callback;
            }
            child.stdin.write(command, 'utf8');
        }

        if (shell) cmdCallback(null, write);
    });
};
