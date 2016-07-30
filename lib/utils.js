"use strict";

var execSync = require('child_process').execSync;

/**
 * print errors to console in an asynchronuous chain
 * 
 * @param {string} err message text
 * @param {string} cmd error triggering command
 * @param {function (boolean)} [callback] allways called with true
 * @return void
 */
exports.errorPrinter = function (callback, self) {
    return function (err) {
        if (err) {
            console.error(`Error in ${err.toolbox || "svg-icon-toolbox"}:\n  ${err.message}`);
            return callback(true, self);
        }
        return callback(null, self);
    };
};

/**
 * enhances error with a custom header line
 */
exports.raiseErr = function (err, cmd, callback) {
    if (!(err instanceof Error)) {
        err = new Error(err);
    }
    if (err.toolbox === undefined) err.toolbox = cmd;
    return callback(err);
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

// determine incomplete values or throw error on incomputables
function viewPortValues (width, height, viewBox) {
    var errMessage =  'Cannot determine the size of the drawing.';

    var values = {}, vb, widthUnit, heightUnit;
    if (viewBox) {
        vb = viewBox.split(/[,\s]+/).map((str) => {
            return parseFloat(str);
        });
        if (vb[2] === 0 || vb[3] === 0) throw new Error(errMessage);
    }

    var regex = /[\d\.]+(?:px)?(.+)?$/;
    if (width) {
        widthUnit = width.match(regex)[1];
        values.width = parseFloat(width);
        if (values.width === 0) throw new Error(errMessage);
    }
    if (height) {
        heightUnit = height.match(regex)[1];
        values.height = parseFloat(height);
        if (values.height === 0) throw new Error(errMessage);
    }

    if (vb && vb.length === 4) {
        values.viewBox = vb;
        if (widthUnit) {
            if (widthUnit === '%' && values.width) {
                values.width *= vb[2] / 100;
            } else {
                throw new Error(errMessage);
            }
        }
        if (!values.width) {
            values.width = vb[2];
        }
        if (heightUnit) {
            if (heightUnit === '%' && values.height) {
                values.height *= vb[3] / 100;
            } else {
                throw new Error(errMessage);
            }
        }
        if (!values.height) {
            values.height = vb[3];
        }
    } else if (widthUnit || heightUnit || !values.width || !values.height) {
        throw new Error(errMessage);
    }
    return values;
}

/**
 * compute equivalent transform from a viewport definition
 * @see https://svgwg.org/svg2-draft/coords.html#ComputingAViewportsTransform
 * @see https://www.w3.org/Bugs/Public/show_bug.cgi?id=29751
 */
exports.computeTransform = function (width, height, viewBox, preserveAspectRatio) {
    var viewport = viewPortValues(width, height, viewBox);
    if (!viewport.viewBox) return [];

    var par = preserveAspectRatio ? preserveAspectRatio.split(/\s/) : [];
    var align = par[0] || 'xMidYMid';
    var meetOrSlice = par[1] || 'meet';

    var sx = viewport.width / viewport.viewBox[2],
        sy = viewport.height / viewport.viewBox[3];
    if (align !== 'none') {
        if (meetOrSlice === 'slice') {
            sx = sy = Math.max(sx, sy);
        } else {
            sx = sy = Math.min(sx, sy);
        }
    }
    var tx = -viewport.viewBox[0] * sx,
        ty = -viewport.viewBox[1] * sy;

    if (align.includes('xMid')) {
        tx += (viewport.width - viewport.viewBox[2] * sx) / 2;
    }
    if (align.includes('xMax')) {
        tx += (viewport.width - viewport.viewBox[2] * sx);
    }
    if (align.includes('YMid')) {
        ty += (viewport.height - viewport.viewBox[3] * sy) / 2;
    }
    if (align.includes('YMax')) {
        ty += (viewport.height - viewport.viewBox[3] * sy);
    }
    
    var transform = [];
    if (tx !== 0 || ty !== 0) {
        transform.push(`translate(${tx} ${ty})`);
    }
    if (sx !== 1 || sy !== 1) {
        transform.push(`scale(${sx} ${sy})`);
    }
    return transform;
};
