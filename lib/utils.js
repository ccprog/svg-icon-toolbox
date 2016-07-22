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

/**
 * @see https://svgwg.org/svg2-draft/coords.html#ComputingAViewportsTransform
 * @see https://www.w3.org/Bugs/Public/show_bug.cgi?id=29751
 */
exports.computeTransform = function (width, height, viewBox, preserveAspectRatio) {
    var vbRaw = viewBox ? viewBox.split(/[,\s]+/) : [], vb;
    if (!width || !height) {
        if (vbRaw.length !== 4) throw new Error('cannot interpret initial SVG size');
    }
    vb = vbRaw.length === 4 ? vbRaw : [0, 0, width, height];
    if (!width) width = vb[2];
    if (!height) height = vb[3];

    var par = preserveAspectRatio ? preserveAspectRatio.split(/\s/) : [];
    var align = par[0] || 'xMidYMid';
    var meetOrSlice = par[1] || 'meet';

    width = parseFloat(width);
    height = parseFloat(height);
    vb = vb.map((val) => {
        return parseFloat(val);
    });

    var sx = width / vb[2],
        sy = height / vb[3];
    if (align !== 'none') {
        if (meetOrSlice === 'slice') {
            sx = sy = Math.max(sx, sy);
        } else {
            sx = sy = Math.min(sx, sy);
        }
    }
    var tx = -vb[0] * sx,
        ty = -vb[1] * sy;

    if (align.includes('xMid')) {
        tx += (width - vb[2] * sx) / 2;
    }
    if (align.includes('xMax')) {
        tx += (width - vb[2] * sx);
    }
    if (align.includes('YMid')) {
        ty += (height - vb[3] * sy) / 2;
    }
    if (align.includes('YMax')) {
        ty += (height - vb[3] * sy);
    }
    
    var transform = [];
    if (tx !== 0 || ty !== 0) {
        transform.push(`translate(${tx} ${ty})`);
    }
    if (sx !== 1 || sy !== 1) {
        transform.push(`scale(${sx} ${sy})`);
    }
    return transform.length ? transform.join(' ') : null;
};
