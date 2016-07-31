"use strict";

var cheerio = require('cheerio');
var async = require('async');
var fs = require('fs');
var path = require('path');
var normalize = async.asyncify(path.normalize);

var utils = require('./lib/utils.js');
var Loaded = require('./lib/Loaded.js');

/**
 * @module toolbox
 */
/**
 * @function callback
 * @param {any} error
 * @param {Loaded} loaded
 * @return void
 */

/**
 * Load a svg file for editing and/or exporting from.
 * 
 * @param {string} sourceFn qualified file name
 * @param {module:toolbox~callback} callback node style callback gets the
 *     {@link Loaded} object.
 * @return void
 */
exports.load = function (sourceFn, callback) {
    var errorPrinter = utils.errorPrinter(callback);
    async.waterfall([
        async.apply(normalize, sourceFn),
        (fn, next) => {
            process.stdout.write(`Reading ${fn}...`);
            next(null, fn);
        },
        async.apply(fs.readFile),
        (content, next) => {
            var $ = cheerio.load(content.toString(), {
                xmlMode: true
            });
            if (!$('svg').length) {
                return utils.raiseErr('No SVG content detected.', null, next);
            }
            console.log('OK');
            return next(null, new Loaded($, sourceFn));
        }
    ], (err, loaded) => {
        if (err) return utils.raiseErr(err, 'file I/O', errorPrinter);
        return callback(null, loaded);
    });
};

/**
 * Load and batch process a svg file.
 * 
 * @param {string} sourceFn qualified file name
 * @param {Object[]} tasks a series of tasks to perform in the loaded file
 * @param {string} tasks.task name of a Loaded method
 * @param {string|Object} tasks.arg the first argument for that method (either a
 *     file name or an options object)
 * @param {module:toolbox~callback} callback node style callback gets the
 *     {@link Loaded} object.
 * @return void
 */
exports.batch = function (sourceFn, tasks, callback) {
    exports.load(sourceFn, (err, loaded) =>{
        if (err) return callback(err, loaded);
        async.eachSeries(tasks, (item, next) => {
            loaded[item.task](item.arg, next);
        }, (err) => {
            callback(err, loaded);
        });
    });
};
