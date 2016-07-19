"use strict";

module.exports = function (opt) {
    var istanbul = require('istanbul');
//    istanbul.config.loadFile(false, {
//        instrumentation: { variable: opt.coverageVar },
//        reporting: { dir: opt.dir }
//    });        

    var SandboxedModule = require('sandboxed-module');
    SandboxedModule.registerBuiltInSourceTransformer('istanbul');
    global[opt.coverageVar] = {};

    var collector, reporter;

    return {
        jasmineStarted: function () {
            collector = new istanbul.Collector();
            reporter = new istanbul.Reporter();
            reporter.addAll(opt.reports);
        },
        suiteStarted: function () {},
        suiteDone: function () {},
        specStarted: function () {},
        specDone: function () {},
        jasmineDone: function () {
            console.log('\n\n');
            collector.add(global[opt.coverageVar]);
            reporter.write(collector, true, function () {
                return;
            });
        }
    };
};