"use strict";

var cheerio = require('cheerio');
var async = require('async');
var fs = require('fs');
var path = require('path');
var normalize = async.asyncify(path.normalize);

var utils = require('./lib/utils.js');
var stylesheet = require('./lib/stylesheet.js');
var inline = require('./lib/inline.js');
var iconizePng = require('./lib/iconize-png.js');
var iconizeSvg = require('./lib/iconize-svg.js');

var $, sourceFn;
var isOpen = false;

/**
 * @module toolbox
 */

/**
 * Load a svg file for editing and/or exporting from.
 * 
 * @param {string} fn qualified file name
 * @param {function} callback node style error callback `(any) => void`
 * @return void
 */
exports.load = function (fn, callback) {
    async.waterfall([
        async.apply(normalize, fn),
        async.asyncify((fn) => {
            process.stdout.write(`Reading ${fn}...`);
            return fn;
        }),
        async.apply(fs.readFile),
        (content, next) => {
            $ = cheerio.load(content.toString(), {
                xmlMode: true
            });
            if (!$('svg').length) {
                // TODO: double call!
                return utils.handleErr('No SVG content detected.', null, callback);
            }
            sourceFn = fn;
            isOpen = true;
            console.log('OK');
            return next(null);
        }
    ], (err) => {
        if (err) return utils.handleErr(err, 'file I/O', callback);
        return callback(null);
    });
};

/**
 * Write stylesheets into the loaded file; all pre-existing style sheets are removed.<br/>
 * The callback will return an error if no file has been previously loaded.
 * 
 * @param {string|string[]} opt.src single .css or .scss file name or Array of file names
 * @param {Object} [opt.sassOptions] node-sass compiler options, excluding file,
 *     data and sourceMap. Note that `includePaths` defaults to the respective
 *     directory of each file if omitted
 * @param {function} callback node style error callback `(any) => void`
 * @return void
 */
exports.stylize = function (opt, callback) {
    if (!isOpen) return utils.handleErr('No file loaded.', null, callback);
    if (!opt) {
        return utils.handleErr('No valid options.', null, callback);
    } else if (!Array.isArray(opt.src) && typeof opt.src !== 'string') {
        return utils.handleErr('No stylesheet supplied.', null, callback);
    }

    // collect external stylesheet
    stylesheet.collect(opt, (err, ruleset) => {
        if (err) return callback(err);
        // insert all Css texts as one stylesheet
        $('style').remove();

        var $style = $('<style type="text/css"></style>');
        ruleset.unshift('<![CDATA[');
        ruleset.push(']]>');
        $style.text(ruleset.join('\n'));
        var $defs = $('defs');

        if (!$defs.length) {
            $defs = $('<defs></defs>');
            $('svg').prepend($defs);
        }
        $defs.first().prepend($style);
        console.log('Styles inserted.');
        return callback(null);
    });
};

/**
 * Distribute all styles from the style sheets of the loaded file
 * to inline style attributes. Note that @-rules are ignored; the `<style>`
 * elements are subsequently removed.<br/>
 * The callback will return an error if no file has been previously loaded.
 * 
 * @param {string|string[]} opt.src single .css or .scss file name or Array of file
 *      names of extra stylesheet(s) to apply before each internal stylesheet
 * @param {Object} [opt.sassOptions] node-sass compiler options, excluding file,
 *     data and sourceMap. Note that `includePaths` defaults to the respective
 *     directory of each file if omitted
 * @param {function} callback node style error callback `(any) => void`
 * @return void
 */
exports.inline = function (opt, callback) {
    if (!isOpen) return utils.handleErr('No file loaded.', null, callback);
    if (!opt) opt = {};

    // collect external stylesheet
    stylesheet.collect(opt, (err, ruleset) => {
        if (err) return callback(err);
        //collect internal stylesheets
        $('style').each((i, el) => {
             // make sure CDATA is stripped
             var text = $(el).text();
             var match = /<!\[CDATA\[([^]*)\]\]>/.exec(text);
             ruleset.push(match ? match[1] : text);
        });
        console.log(`Found ${ruleset.length} stylesheets.` );

        return inline($, ruleset, callback);
    });
};

/**
 * Write the loaded file to a target file.<br/>
 * The callback will return an error if no file has been previously loaded.
 * 
 * @param {string} [targetFn] qualified file name. Defaults to overwriting
 *     the source of the loaded file.
 * @param {function} callback node style error callback `(any) => void`
 * @return void
 */
exports.write = function (targetFn, callback) {
    if (!isOpen) return utils.handleErr('No file loaded.', null, callback);

    async.waterfall([
        async.apply(normalize, targetFn || sourceFn),
        (targetFn, next) => {
            process.stdout.write(`Exporting ${targetFn}...`);
            fs.writeFile(targetFn, $.xml(), next);
        }
    ], (err) => {
        if (err) return utils.handleErr(err, 'file I/O', callback);
        console.log('OK');
        return callback(null);
    });
};

/**
 * Export a list of objects from the loaded file to separate icon files.<br/>
 * The callback will return an error if no file has been previously loaded.
 * 
 * @param {string[]} opt.ids list of object ids to export
 * @param {string} opt.format png or svg
 * @param {string} [opt.dir=.] directory to write to
 * @param {string} [opt.postfix] name exported files in the form
 *     `${id}${postfix}.${format}`
 * @param {string|function} [opt.postProcess]: executed on the
 *     exported file. If a string, as a CLI command, if a function, directly.
 *     Both get the qualified file name as argument. A function should have
 *     the form `(fileName, callback) => void` and execute the callback with
 *     `(err)`.
 * @param {Object} [opt.exportOptions]  
 *     for Png, the following `inkscape --export-${cmd}` command line options
 *       are permissible: background, background-opacity, use-hints, dpi,
 *       text-to-path, ignore-filters, width and height.<br/>
 *     for Svg, `width`, `height` and `preserveAspectRatio` can be set as attributes
 *       of the root svg element. The `viewBox` attribute will be set to the bounding
 *       box of the exported object.
 * @param {function} callback node style error callback `(any) => void`
 * @return void
 */
exports.export = function (opt, callback) {
    if (!isOpen) return utils.handleErr('No file loaded.', null, callback);
    if (!opt) {
        return utils.handleErr('No valid options.', null, callback);
    } else if (!Array.isArray(opt.ids)) {
        return utils.handleErr('No valid id list.', null, callback);
    }
    if (!opt.exportOptions) opt.exportOptions = {};

    async.waterfall([
        async.apply(normalize, opt.dir || '.'),
        async.apply(utils.testDir)
    ], (err) => {
        if (err) return utils.handleErr(err, 'file I/O', callback);
        switch (opt.format) {
        case 'png':
            iconizePng(sourceFn, opt, callback);
            break;
        case 'svg':
            let tasks = [async.apply(iconizeSvg, sourceFn, $, opt)];
            if ($('style').length) {
                tasks.unshift(async.apply(exports.inline, {}));
            }
            async.series(tasks, callback);
            break;
        default:
            return utils.handleErr('No valid export format.', null, callback);
        }
    });
};