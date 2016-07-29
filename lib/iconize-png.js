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

var postProcess, targetList;

// file export
function toFile (targetFn, command, shell, callback) {
    async.waterfall([
        async.apply(normalize, targetFn + '.png'),
        (targetFn, next) => {
            command += `--export-png="${targetFn}"\n`;
            console.log('Exporting ' + targetFn);
            shell(command, new RegExp(`Bitmap.*: (.*${targetFn})$`), next);
        },
        processExported
    ], (err) => {
        if (err) return utils.raiseErr(err, 'file I/O', callback);
        return callback();
    });
}

// post-process exported files
function processExported (exportFn, callback) {
    if (typeof postProcess === 'string') {
        return spawn(postProcess + ` ${exportFn}`, false, callback);
    }
    if (typeof postProcess === 'function') {
        return postProcess(exportFn, callback);
    }
    callback();
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
    postProcess = opt.postProcess;
    targetList = opt.ids;

    // collect export options
    var cmdCommon = '--export-id-only ';
    for (let prop in opt.exportOptions) {
        if (pngOptions.indexOf(prop) >= 0 && opt.exportOptions[prop] !== false) {
            cmdCommon += `--export-${prop}`;
            if (typeof opt.exportOptions[prop] !== 'boolean') {
                cmdCommon += `="${opt.exportOptions[prop]}"`;
            }
            cmdCommon += ' ';
        }
    }

    // start inkscape shell
    spawn('inkscape --shell', true, (err, shell) => {
        if (err) return callback(err);
        console.log('Rendering...');

        // process each id
        async.each(opt.ids, (id, next) => {
            var targetFn = `${opt.dir || '.'}/${id}`;
            if (opt.suffix) {
                targetFn += opt.suffix;
            }
            var command = `${sourceFn} ${cmdCommon}--export-id="${id}" `;
            toFile(targetFn, command, shell, next);
        }, (err) => {
            shell('quit\n', null, () => {});
            callback(err);
        });
    });
};
