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
          useHelpers: false,
          reporters: {
            console: {}
          },
          customReporters: [
            require('./tests/lib/istanbul-reporter.js').init({
              instrumenting: {
                coverageVariable: '__coverage__'
              },
              reporting: {
                dir: './tests/coverage',
                reports: ['text','lcov','html']
              }
          })
          ]
      },
      default: {
          specs: [ 'tests/unit/**' ]
      }
    },
    jsdoc2md: {
      oneOutputFile: {
        options: {
          'module-index-format': 'none',
          'heading-depth': 3,
          'name-format': 'code',
          'param-list-format': 'list',
          partial: ['doc/*.hbs'],
          template: grunt.file.read('doc/readme.hbs')
        },
        src: ['index.js', 'lib/Loaded.js', 'lib/iconize.js'],
        dest: 'README.md'
      }
    },
    coveralls: {
      default: {
        src: 'tests/coverage/*.info',
      }
    }
  });

  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-jasmine-nodejs');
  grunt.loadNpmTasks('grunt-jsdoc-to-markdown');
  grunt.loadNpmTasks('grunt-coveralls');
  grunt.registerTask('test', ['jshint', 'jasmine_nodejs']);
  grunt.registerTask('build', ['jsdoc2md', 'coveralls']);
};