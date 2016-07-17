"use strict";

var execSync = require('child_process').execSync;
var normalize = require('path').normalize;

/**
 * print errors to console in an asynchronuous chain
 * 
 * @param {string} err message text
 * @param {string} cmd error triggering command
 * @param {function (boolean)} [callback]
 * @return {any} true or result of callback
 */
exports.handleErr = function (err, cmd, callback) {
    console.error(`Error in ${cmd || "svg-icon-toolbox"}:\n  %s`, err);
    return callback ? callback(true) : true;
};

/**
 * async wrapper for path.normalize
 * 
 * @param {string} str path
 * @param {function (any)} callback
 */
exports.normalize = function (str, callback) {
    try {
        return callback(null, normalize(str));
    } catch (err) {
        return callback(err.message);
    }
};

/**
 * synchronuously make sure a directory exists
 * 
 * @param {string} dir directory name to make as needed
 * @param {function (any)} callback
 */
exports.testDir = function (dir, callback) {
    try {
        execSync(`mkdir -p ${dir}`);
        return callback(null);
    } catch (err) {
        return callback(err.message);
    }
};