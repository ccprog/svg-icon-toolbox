"use strict";

var async = require('async');
var css = require('css');
var sass = require('node-sass');
var readFile = require('fs').readFile;
var path = require('path');

var utils = require('./utils.js');

/**
 * process function: validate a Css file
 * 
 * @param {{text: string, file: string}} content
 * @param {function (any, string)} callback
 */
var validate = exports.validate = function (content, callback) {
    try {
        process.stdout.write(`Validating ${content.file}...` );
        css.parse(content.text);
        console.log('OK');
        return callback(null, content.text);
    } catch (err) {
         return utils.handleErr(err, 'CSS file ' + content.file, callback);
    }
};

/**
 * process function: compile a Sass file
 * 
 * @param {{text: string, file:string}} content
 * @param {Object} [sassOptions] Sass compiler options, excluding file, data and sourceMap
 * @param {function (any, string)} callback
 */
var compileSass = exports.compileSass = function (content, sassOptions, callback) {
    if (!sassOptions) sassOptions = {};
    var source = Object.assign(sassOptions, {
        file: null,
        includePaths :sassOptions.includePaths || [path.dirname(content.file)],
        sourceMap: false,
        data: content.text,
    });

    process.stdout.write(`Compiling ${content.file}...` );
    sass.render(source, (err, result) => {
        if (err) return utils.handleErr(err,
            `SCSS file ${content.file}, line ${err.line}, column ${err.column}`,
            callback);
        console.log('OK');
        return callback(null, result.css.toString());
    });
};

/**
 * collect css/scss texts from files
 * 
 * @param {{ src: string[], sassOptions: Object= }} opt
 *   src: single .css or .scss file name or Array of file names
 *   sassOptions: node-sass compiler options, excluding file, data and
 *     sourceMap. Note that includePaths defaults to the respective
 *     directory of each file if omitted
 * @param {function (any, string): string[]} [collectionCallback] callback for processing
 * the array of processed text
 */
exports.collect = function (opt, collectionCallback) {
    var src = opt.src;
    if (typeof opt.src === 'string') {
        src = [opt.src];
    } else if (!Array.isArray(opt.src) || opt.src.length === 0) {
        // no file to collect from, give back empty array immediately
        return collectionCallback(null, []);
    }

    // array is emitted at the end of mapping
    async.map(src, (loc, processCallback) => {
        async.waterfall([
            async.apply(utils.normalize, loc),
            async.asyncify((loc) => {
                process.stdout.write(`Reading ${loc}...`);
                return loc;
            }),
            async.apply(readFile)
        ], (err, data) => {
            if (err)  return utils.handleErr(err, 'file I/O', processCallback);
            console.log('OK');

            var content = {
                text: data.toString(),
                file: loc
            };
            switch (path.extname(loc)) {
            case '.css':
                return validate(content, processCallback);
            case '.scss':
                return compileSass(content, opt.sassOptions, processCallback);
            }
        });
    }, collectionCallback);
};
