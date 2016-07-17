'use strict';

module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    jshint: {
      all: [
        'index.js',
        'lib/*.js',
      ],
      options: {
        jshintrc: '.jshintrc'
      }
    },
    jasmine_nodejs: {
      options: {
          specNameSuffix: 'spec.js',
          useHelpers: false
      },
      default: {
          specs: [ 'tests/unit/**' ]
      }
    }
  });

  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-jasmine-nodejs');
};