"use strict";

var async = require('async');
var fs = require('fs');
var path = require('path');
var os =  require('os');
var normalize = async.asyncify(path.normalize);

var utils = require('./utils.js');
var iconizePng = require('./iconize-png.js');
var iconizeSvg = require('./iconize-svg.js');

/**
 * Export a list of objects from the loaded file to separate icon files, either
 * in PNG or SVG format.
 * 
 * The command needs a list of object IDs from the loaded file to export. The
 * exported files will be nemed from these IDs. The list can be in the form
 * of an Array included as `opt.ids` or imported from an external file named
 * as `opt.idFile`. Such a file must consist only of the object ids, each
 * on its own line. A file superceeds the ID Array, if both exist.
 * 
 * For SVG, if the {@link Loaded} object contains stylesheets, the exported
 * files will have all styles distributed to inline style attributes. Despite
 * this, the Loaded object returned by the callback is guaranteed to be
 * unaltered.
 * 
 * @function Loaded#export
 * @param opt {Object}
 * @param {string[]} [opt.ids] list of object ids to export. If missing,
 *     opt.idFile must be given.
 * @param {string[]} [opt.idFile] name of file containing object ids to export.
 *     If missing, opt.ids must be given.
 * @param {string} opt.format png or svg
 * @param {string} [opt.dir=.] directory to write to
 * @param {string} [opt.suffix] name exported files in the form
 *     `${id}${postfix}.${format}`
 * @param {string|function} [opt.postProcess]: executed on the
 *     exported file. If a string, as a CLI command, if a function, directly.
 *     Both get the qualified file name as argument. A function should have
 *     the form `(fileName, callback) => void` and execute the callback with
 *     `(err)`.
 * @param {Object} [opt.exportOptions]  
 *     for PNG, the following `inkscape --export-${cmd}` command line options
 *       are permissible: background, background-opacity, use-hints, dpi,
 *       text-to-path, ignore-filters, width and height.<br/><br/>
 *     for SVG, `width`, `height` and `preserveAspectRatio` can be set as attributes
 *       of the root svg element. The `viewBox` attribute will be set to the bounding
 *       box of the exported object.
 * @param {module:toolbox~callback} callback node style callback gets the
 *     {@link Loaded} object.
 * @return void
 */
module.exports = function (opt, callback) {
    var errorPrinter = utils.errorPrinter(callback, this);
    if (!opt) {
        return utils.raiseErr('No valid options.', null, errorPrinter);
    } else if (!Array.isArray(opt.ids) && typeof opt.idFile !== 'string') {
        return utils.raiseErr('No valid id list.', null, errorPrinter);
    }
    if (!opt.exportOptions) opt.exportOptions = {};

    var tmpfile = os.tmpdir() + path.sep + process.pid;
    tmpfile += new Date().getTime() + '-svg-icon-toolbox.svg';

    var prepareDir = (next) => {
        async.waterfall([
            async.apply(normalize, opt.dir || '.'),
            async.apply(utils.testDir),
        ], next);
    };

    var readIds = (next) => {
        async.waterfall([
            async.apply(utils.readLines, opt.idFile),
            (ids, next) => {
                opt.ids = ids;
                next();
            }
        ], next);
    };

    var $copy;
    var stash = (next) => {
        $copy = this.$.root().children('svg').clone();
        next();
    };

    var restore = (next) => {
        this.$.root().children('svg').replaceWith($copy);
        next();
    };

    var series = [
        prepareDir,
        (next) => this.write(tmpfile, next),
    ];

    if (opt.idFile) {
        series.push(readIds);
    }

    switch (opt.format) {
    case 'png':
        series.push((next) => iconizePng(tmpfile, opt, next));
        break;
    case 'svg':
        series.push((next) => iconizeSvg(tmpfile, this.$, opt, next));
        if (this.$('style').length) {
            series.splice(1, 0, stash, (next) => this.inline({}, next));
            series.push(restore);
        }
        break;
    default:
        return utils.raiseErr('No valid export format.', null, errorPrinter);
    }
    series.push((next) => {
        process.stdout.write(`Removing ${tmpfile}...`);
        fs.unlink(tmpfile, next);
    },
    (next) => {
        console.log('OK');
        next();
    });
    async.series(series, (err) => {
        if (err) return utils.raiseErr(err, 'file I/O', errorPrinter);
        return callback(null, this);
    });
};
