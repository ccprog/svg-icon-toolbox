"use strict";

var toolbox = require('../index.js');

module.exports = function(grunt) {

    grunt.registerMultiTask('svg_icon_toolbox',
                            'batch process SVG asset files',
                            function () {
        var done = this.async();
        var counter = 0;
        
        console.time('Processing time');
        this.filesSrc.filter((filepath) => {
            if (!grunt.file.exists(filepath)) {
                grunt.log.warn(`Source file "${filepath}" not found.`);
                return false;
            } else if (!grunt.file.isMatch({matchBase:true}, '*.svg', filepath)) {
                grunt.log.warn(`Source file "${filepath}" not identified as SVG.`);
                return false;
            } else {
                counter++;
                return true;
            }
        }).forEach((filepath) => {
            grunt.log.subhead(`Processing source file "${filepath}".`);

            toolbox.batch(filepath, this.options().tasks, (err) => {
                if (err) {
                    grunt.verbose.error();
                } else {
                    grunt.verbose.ok();
                }
                counter--;
                if (err || counter === 0) {
                    console.timeEnd('Processing time');
                    done(err);
                }
            });
        });
    });
};