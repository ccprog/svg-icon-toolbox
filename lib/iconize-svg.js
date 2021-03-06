"use strict";

var writeFile = require('fs').writeFile;
var async = require('async');
var path = require('path');
var normalize = async.asyncify(path.normalize);
var pd = require('pretty-data').pd;

var utils = require('./utils.js');
var spawn = require('./spawn.js');

// recognized options for svg export
const svgOptions = [
    'width',
    'height',
    'preserveAspectRatio'
];

// properties that can contain functional links
const funcProps = [
    'clip-path',
    'marker',
    'marker-start',
    'marker-mid',
    'marker-end',
    'mask',
    'fill',
    'stroke'
];

const funcRegex = /url\((#.*)\)/;

// elements always removed
const remove = [
    'animate',
    'animateColor',
    'animateMotion',
    'animateTransform',
    'cursor',
    'script',
    'set'
].join(',');

// elements always preserved
const preserve = [
    'color-profile',
    'font'
].join(',');

// elements whose links are ignored
const ignore = [
    'a',
    'altGlyph'
].join(',');

var $, $svg, postProcess, targetList;
var dimensions = {};

// prepare SVG for reduction
function preTransform (callback) {
    // boilerplate object
    $svg = $.root().children('svg');
    //cache viewport information
    $svg.data({
        transform: $svg.attr('transform') || null,
        preserveAspectRatio: $svg.attr('preserveAspectRatio') || null
    });

    //move old viewport information to transform
    var transform = utils.computeTransform(
        $svg.attr('width'),
        $svg.attr('height'),
        $svg.attr('viewBox'),
        $svg.attr('preserveAspectRatio')
    );
    if (transform.length) {
        var preTransform = $svg.attr('transform');
        if (preTransform) {
            transform.push(preTransform);
        }
        $svg.attr('transform', transform.join(' '));
    }
    $svg.attr('preserveAspectRatio', null);
    
    callback();
}

// restore original SVG
function postTransform (callback) {
    // copy boilerplate back in
    $.root().children('svg').replaceWith($svg);
    // get viewport information from cache
    $svg.attr({
        transform: $svg.data('transform'),
        preserveAspectRatio: $svg.data('preserveAspectRatio')
    });

    callback();
}

// collects object viewBoxes for all listed ids
function listViewBoxes (entries, callback) {
    entries.forEach((entry) => {
        var args = entry.split(',');
        if (targetList.indexOf(args[0]) >= 0) {
            let id = args.shift();
            dimensions[id] = args;
        }
    });
    callback();
}

// produces a copy of the svg object and removes everything
// not needed for a single icon export
function reduceTo ($copy, id) {
    var reflist = new Set();

    //mark elements for preservation
    function mark (ref) {
        var $target = $copy.find(ref);
        //avoid doubles
        if (!$target.parents(preserve).length && !reflist.has(ref)) {
            reflist.add(ref);

            //mark for preservation
            $target.prop('refby', id);
            //mark as having preserved children
            $target.parentsUntil('svg').prop('passedby', id);
        }

        //find links
        $target.find('*').addBack() // descendents and self
            .add($target.parents()) // parents
            .not([remove, ignore, preserve].join(','))
            .each((i, el) => {
                var $elem = $(el);
                //unpack links and recurse
                var link = $elem.attr('xlink:href');
                if(link) {
                    mark(link);
                }
                funcProps.forEach((prop) => {
                    var value = $elem.css(prop) || $elem.attr(prop);
                    link = funcRegex.exec(value);
                    if (link) {
                        mark(link[1]);
                    }
                });
        });
    }

    //remove elements not needed
    function sweep ($inspect) {
        //filter out elements generally preserved
        $inspect.children().not(preserve).each((i, el) => {
            var $child = $(el);
            //elements with children to be preserved: recurse
            if ($child.prop('passedby') === id && $child.prop('refby') !== id) {
                sweep($child);
            //elements without mark: remove
            } else if ($child.is(remove) || $child.prop('refby') !== id) {
                $child.remove();
            }
        });
    }

    mark('#' + id);

    sweep($copy);
    return $copy;
}

// file export
function toFile (targetFn, text, callback) {
    async.waterfall([
        async.apply(normalize, targetFn),
        (targetFn, next) => {
            console.log('Exporting ' + targetFn);
            writeFile(targetFn, text, (err) => {
                next(err, targetFn);
            });
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
 * @param {Object} root Cheerio root object
 * @param {{ ids: string[], format: string, dir: string=, suffix: string=, exportOptions: Object }} opt
 *   ids: list of object ids to export,
 *   dir: directory to write to, defaults to ".",
 *   suffix: name exported files in the form ${id}${suffix}.${format}
 *   postProcess: executed on the exported file. if a string, as a cli command, if a
 *     function, directly. Both get the qualified file name as argument. A function
 *     should take the arguments (fileName, callback) and execute the callback with
 *     (err).
 *   exportOptions: width, height and preserveAspectRatio can be set as attributes
 *     of the root svg element. The viewBox attribute will be set to the bounding box
 *     of the exported object.
 * @return void
 */
module.exports = function (sourceFn, root, opt, callback) {
    $ = root;
    targetList = opt.ids;
    postProcess = opt.postProcess;

    async.waterfall([
        preTransform,
        // collect viewBox information for ids
        async.apply(spawn, 'inkscape -S '+ sourceFn, false),
        listViewBoxes,
        // process each id
        async.apply(async.each, targetList, (id, next) => {
            if (!dimensions[id]) {
                return utils.raiseErr(`object ${id} not found in loaded source.`, 'SVG', next);
            }
            //clone from boilerplate and reduce to single icon
            var $copy = reduceTo($svg.clone(), id);

            //crop
            $copy.attr('viewBox', dimensions[id].join(' '))
                .attr('width', null)
                .attr('height', null);
            if (!opt.exportOptions.width && !opt.exportOptions.height) {
                $copy.attr('width', dimensions[id][2])
                    .attr('height', dimensions[id][3]);
            } else {
                svgOptions.forEach((attr) => {
                    if (opt.exportOptions[attr]) {
                        $copy.attr(attr, opt.exportOptions[attr]);
                    }
                });
            }

            //exchange for copy
            $.root().children('svg').replaceWith($copy);

            var text = pd.xml($.xml());
            var targetFn = `${opt.dir || "."}/${id}`;
            if (opt.suffix) {
                targetFn += opt.suffix;
            }
            toFile(targetFn + '.svg', text, next);
        }),
        postTransform
    ], callback);
};
