"use strict";

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
        spawn(`optipng -o7 --quiet "${filtered[1]}"`, null, null, false, globalCallback);
    }
}

/**
 * @param {string} sourceFn source file name
 * @param {{ ids: string[], format: string, dir: string=, postfix: string=, exportOptions: Object }} opt
 *   ids: list of object ids to export,
 *   format: png or svg,
 *   dir: directory to write to, defaults to ".",
 *   postfix: name exported files in the form ${id}${postfix}.${format}
 *   exportOptions: width, height and preserveAspectRatio can be set as attributes
 *     of the root svg element. The viewBox attribute will be set to the bounding
 *     box of the exported object.
 * @return void
 */
module.exports = function  (sourceFn, opt, callback) {
    globalCallback = callback;
    var inkscape = spawn('inkscape --shell', optiPng, null, true, globalCallback);

    console.log('Rendering...');
    //feed commands to the inkscape shell
    opt.ids.forEach((id) => {
        var command = `--export-id="${id}" --export-id-only `;
        for (let prop in opt.exportOptions) {
            if (pngOptions.indexOf(prop) >= 0) {
                command += `--export-${prop}=${opt.exportOptions[prop]} `;
            }
        }
        command += '--export-png="';
        var targetFn = `${opt.dir}/${id}`;
        if (opt.postfix) {
            targetFn += opt.postfix;
        }
        utils.normalize(targetFn + '.png', (err, targetFn) => {
            if (err) return utils.handleErr(err, 'file I/O', callback);

            command += targetFn +`" ${sourceFn}\n`;
            console.log('Exporting ' + targetFn);
            inkscape.write(command, 'utf8');
        });
    });

    inkscape.write('quit\n');
};
