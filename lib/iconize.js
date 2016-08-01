"use strict";

var async = require('async');
var fs = require('fs');
var path = require('path');
var os =  require('os');
var normalize = async.asyncify(path.normalize);

var utils = require('./utils.js');
var iconizePng = require('./iconize-png.js');
var iconizeSvg = require('./iconize-svg.js');

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
