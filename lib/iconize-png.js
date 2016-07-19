"use strict";

var async = require('async');

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

var globalCallback;

// identifies exported file from inkscape --export-id command
// and post-processes with optipng
function optiPng (line) {
    var filtered = /Bitmap.*: (.*)$/.exec(line);
    if (filtered && filtered[1]) {
        spawn(`optipng -o7 --quiet "${filtered[1]}"`, null, false, globalCallback);
    }
}

/**
 * @param {string} sourceFn source file name
 * @param {{ ids: string[], dir: string=, suffix: string=, exportOptions: Object }} opt
 *   ids: list of object ids to export,
 *   dir: directory to write to, defaults to ".",
 *   suffix: name exported files in the form ${id}${suffix}.${format}
 *   exportOptions: width, height and preserveAspectRatio can be set as attributes
 *     of the root svg element. The viewBox attribute will be set to the bounding
 *     box of the exported object.
 * @return void
 */
module.exports = function  (sourceFn, opt, callback) {
    globalCallback = callback;
    var inkscape = spawn('inkscape --shell', optiPng, true, callback);

    console.log('Rendering...');
    //feed commands to the inkscape shell
    async.each(opt.ids, (id, nextEach) => {
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
            async.apply(utils.normalize, targetFn + '.png'),
            (targetFn, nextWf) => {
                command += targetFn +`" ${sourceFn}\n`;
                console.log('Exporting ' + targetFn);
                inkscape.write(command, 'utf8');
                nextWf();
            }
        ], nextEach);
    }, (err) => {
        inkscape.write('quit\n');
        if (err) return utils.handleErr(err, 'file I/O', callback);
    });
};
