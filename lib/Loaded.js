"use strict";

var async = require('async');
var fs = require('fs');
var path = require('path');
var os =  require('os');
var normalize = async.asyncify(path.normalize);

var utils = require('./utils.js');
var stylesheet = require('./stylesheet.js');
var inline = require('./inline.js');
var iconizePng = require('./iconize-png.js');
var iconizeSvg = require('./iconize-svg.js');

/** @class */
function Loaded ($, sourceFn) {
    /**
     * the loaded file represented as a
     * [cheerio]{@link https://github.com/cheeriojs/cheerio} object
     * @member {Cheerio}
      */
    this.$ = $;
    /**
     * the name of the loaded file
     * @member {string}
     */
    this.sourceFn = sourceFn;
}

/**
 * Write stylesheets into the loaded file; all pre-existing style sheets are removed.
 * 
 * @param opt {Object}
 * @param {string|string[]} opt.src single .css or .scss file name or Array of file names
 * @param {Object} [opt.sassOptions] node-sass compiler options, excluding file,
 *     data and sourceMap. Note that `includePaths` defaults to the respective
 *     directory of each file if omitted
 * @param {module:toolbox~callback} callback node style callback gets the
 *     {@link Loaded} object.
 * @return void
 */
Loaded.prototype.stylize = function (opt, callback) {
    var errorPrinter = utils.errorPrinter(callback, this);
    if (!opt) {
        return utils.raiseErr('No valid options.', null, errorPrinter);
    } else if (!Array.isArray(opt.src) && typeof opt.src !== 'string') {
        return utils.raiseErr('No stylesheet supplied.', null, errorPrinter);
    }

    // collect external stylesheet
    stylesheet.collect(opt, (err, ruleset) => {
        if (err) return errorPrinter(err);
        // insert all Css texts as one stylesheet
        this.$('style').remove();

        var $style = this.$('<style type="text/css"></style>');
        ruleset.unshift('<![CDATA[');
        ruleset.push(']]>');
        $style.text(ruleset.join('\n'));
        var $defs = this.$('defs');

        if (!$defs.length) {
            $defs = this.$('<defs></defs>');
            this.$('svg').prepend($defs);
        }
        $defs.first().prepend($style);
        console.log('Styles inserted.');
        return callback(null, this);
    });
};

/**
 * Distribute all styles from the style sheets of the loaded file
 * to inline style attributes. Note that @-rules are ignored; the `<style>`
 * elements are subsequently removed.
 * 
 * @param opt {Object}
 * @param {string|string[]} opt.src single .css or .scss file name or Array of file
 *      names of extra stylesheet(s) to apply before each internal stylesheet
 * @param {Object} [opt.sassOptions] node-sass compiler options, excluding file,
 *     data and sourceMap. Note that `includePaths` defaults to the respective
 *     directory of each file if omitted
 * @param {module:toolbox~callback} callback node style callback gets the
 *     {@link Loaded} object.
 * @return void
 */
Loaded.prototype.inline = function (opt, callback) {
    var errorPrinter = utils.errorPrinter(callback, this);
    if (!opt) opt = {};

    // collect external stylesheet
    stylesheet.collect(opt, (err, ruleset) => {
        if (err) return errorPrinter(err);
        //collect internal stylesheets
        this.$('style').each((i, el) => {
             // make sure CDATA is stripped
             var text = this.$(el).text();
             var match = /<!\[CDATA\[([^]*)\]\]>/.exec(text);
             ruleset.push(match ? match[1] : text);
        });
        console.log(`Found ${ruleset.length} stylesheets.` );

        return inline(this.$, ruleset, errorPrinter);
    });
};

/**
 * Write the loaded file to a target file.
 * 
 * @param {string} [targetFn] qualified file name. Defaults to overwriting
 *     the source of the loaded file.
 * @param {module:toolbox~callback} callback node style callback gets the
 *     {@link Loaded} object.
 * @return void
 */
Loaded.prototype.write = function (targetFn, callback) {
    var errorPrinter = utils.errorPrinter(callback, this);

    async.waterfall([
        async.apply(normalize, targetFn || this.sourceFn),
        (targetFn, next) => {
            process.stdout.write(`Exporting ${targetFn}...`);
            fs.writeFile(targetFn, this.$.xml(), next);
        }
    ], (err) => {
        if (err) return utils.raiseErr(err, 'file I/O', errorPrinter);
        console.log('OK');
        return callback(null, this);
    });
};

/**
 * Export a list of objects from the loaded file to separate icon files.
 * 
 * @param opt {Object}
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
 * @param {module:toolbox~callback} callback node style callback gets the
 *     {@link Loaded} object.
 * @return void
 */
Loaded.prototype.export = function (opt, callback) {
    var errorPrinter = utils.errorPrinter(callback, this);
    if (!opt) {
        return utils.raiseErr('No valid options.', null, errorPrinter);
    } else if (!Array.isArray(opt.ids)) {
        return utils.raiseErr('No valid id list.', null, errorPrinter);
    }
    if (!opt.exportOptions) opt.exportOptions = {};

    var tmpfile = os.tmpdir() + path.sep + process.pid;
    tmpfile += new Date().getTime() + '-svg-icon-toolbox.svg';
    var series = [
        (next) => {
            async.waterfall([
                async.apply(normalize, opt.dir || '.'),
                async.apply(utils.testDir),
            ], next);
        },
        (next) => this.write(tmpfile, next),
    ];
    switch (opt.format) {
    case 'png':
        series.push((next) => iconizePng(tmpfile, opt, next));
        break;
    case 'svg':
        if (this.$('style').length) {
            series.splice(1, 0, (next) => this.inline({}, next));
        }
        series.push((next) => iconizeSvg(tmpfile, this.$, opt, next));
        break;
    default:
        return utils.raiseErr('No valid export format.', null, errorPrinter);
    }
    series.push((next) => fs.unlink(tmpfile, next));
    async.series(series, (err) => {
        if (err) return utils.raiseErr(err, 'file I/O', errorPrinter);
        return callback(null, this);
    });
};

module.exports = Loaded;