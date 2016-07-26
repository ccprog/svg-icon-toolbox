"use strict";

var async = require('async');
var path = require('path');
var normalize = async.asyncify(path.normalize);

var utils = require('./utils.js');
var spawn = require('./spawn.js');

// recognized options for png export
const pngOptions = [
    'background',
    'background-opacity',
    'use-hints',
    'dpi',
    'text-to-path',
    'ignore-filters',
    'width',
    'height'
];

var postProcess, globalCallback;

// identifies exported file from inkscape --export-id command
// and post-processes
function processExported (line) {
    var filtered = /Bitmap.*: (.*)$/.exec(line);
    if (filtered && filtered[1]) {
        if (typeof postProcess === 'string') {
            spawn(postProcess + ` "${filtered[1]}"`, null, false, globalCallback, () => {});
        }
        if (typeof postProcess === 'function') {
            postProcess(filtered[1], globalCallback);
        }
    }
}

/**
 * @param {string} sourceFn source file name
 * @param {{ ids: string[], dir: string=, suffix: string=, exportOptions: Object }} opt
 *   ids: list of object ids to export,
 *   dir: directory to write to, defaults to ".",
 *   suffix: name exported files in the form ${id}${suffix}.${format}
 *   postProcess: executed on the exported file. if a string, as a cli command, if a
 *     function, directly. Both get the qualified file name as argument. A function
 *     should take the arguments (fileName, callback) and execute the callback with
 *     (err).
 *   exportOptions: the following inkscape --export-${cmd} command line options are
 *     permissible: background, background-opacity, use-hints, dpi, text-to-path,
 *     ignore-filters, width and height.
 * @return void
 */
module.exports = function  (sourceFn, opt, callback) {
    globalCallback = callback;
    postProcess = opt.postProcess;
    var inkscape;
    async.waterfall([
        async.apply(spawn, 'inkscape --shell', processExported, true, callback),
        (stdin, next) => {
            inkscape = stdin;
            console.log('Rendering...');
            next();
        },
        //feed commands to the inkscape shell
        async.apply(async.each, opt.ids, (id, nextEach) => {
            var command = `--export-id="${id}" --export-id-only `;
            for (let prop in opt.exportOptions) {
                if (pngOptions.indexOf(prop) >= 0 && opt.exportOptions[prop] !== false) {
                    command += `--export-${prop}`;
                    if (typeof opt.exportOptions[prop] !== 'boolean') {
                        command += `="${opt.exportOptions[prop]}"`;
                    }
                    command += ' ';
                }
            }
            command += '--export-png="';
            var targetFn = `${opt.dir || '.'}/${id}`;
            if (opt.suffix) {
                targetFn += opt.suffix;
            }
            async.waterfall([
                async.apply(normalize, targetFn + '.png'),
                (targetFn, nextWf) => {
                    command += targetFn +`" ${sourceFn}\n`;
                    console.log('Exporting ' + targetFn);
                    inkscape.write(command, 'utf8');
                    nextWf();
                }
            ], nextEach);
        })
    ], (err) => {
        if (inkscape) inkscape.write('quit\n');
        if (err) return utils.handleErr(err, 'file I/O', callback);
        return callback();
    });
};
