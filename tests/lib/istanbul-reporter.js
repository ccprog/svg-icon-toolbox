"use strict";

var istanbul = require('istanbul');
var instrumentMethod;

exports.init = function (opt) {
    var collector, reporter;

    global[opt.instrumenting.coverageVariable] = {};

    return {
        jasmineStarted: function () {
            var configObj = istanbul.config.loadFile(false, opt);        
            var instrumenter = new istanbul.Instrumenter(opt.instrumenting);
            instrumentMethod = instrumenter.instrumentSync.bind(instrumenter);
            collector = new istanbul.Collector();
            reporter = new istanbul.Reporter(configObj);
            reporter.addAll(opt.reporting.reports);
        },
        suiteStarted: function () {},
        suiteDone: function () {},
        specStarted: function () {},
        specDone: function () {},
        jasmineDone: function () {
            console.log('\n\n');
            collector.add(global[opt.instrumenting.coverageVariable]);
            reporter.write(collector, true, function () {
                return;
            });
        }
    };
};

exports.transformer =  function (source) {
    source = instrumentMethod(source, this.filename);
    return source;
};