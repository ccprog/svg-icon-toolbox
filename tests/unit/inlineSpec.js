"use strict";

var SandboxedModule = require('sandboxed-module');
SandboxedModule.registerBuiltInSourceTransformer('istanbul');
var cheerio = require('cheerio');
var css = require('css');
var specificity = require('specificity');

describe("module inline", function () {
    var console, utils, inline, callback;
    var source, $xml;

    function loadInline (ruleset) {
        $xml = cheerio.load(source, { xmlMode: true });
        inline($xml, ruleset, callback);
    }

    beforeEach(function () {
        spyOn(css, 'parse').and.callThrough();
        utils = {
            handleErr: jasmine.createSpy('handleErr')  
        };
        console = { log: () => {} };
        inline = SandboxedModule.require('../../lib/inline.js', {
            requires: { 'css': css, 'specificity': specificity, './utils.js': utils },
            globals: { 'console': console },
            sourceTransformers: {
                suppressStdOut: function (source) {
                    return source.replace(/process\.stdout\.write/g, 'console.log');
                }
            }
        });

        callback = jasmine.createSpy('callback');
        source = '<?xml ?><svg id="root"><defs/><g class="one" id="obj1"/><g class="two" id="obj2"/></svg>';
    });

    it("returns silently without source", function () {
        loadInline([]);
        expect(css.parse).toHaveBeenCalledWith('');
        expect(callback).toHaveBeenCalledWith(null);
        expect($xml.xml()).toBe(source);
        callback.calls.reset();
        loadInline(['/*comment*/']);
        expect(css.parse).toHaveBeenCalledWith('/*comment*/');
        expect(callback).toHaveBeenCalledWith(null);
        expect($xml.xml()).toBe(source);
    });

    it("reacts on faulty stylesheets", function () {
        css.parse.and.throwError('message');
        loadInline([]);
        expect(utils.handleErr).toHaveBeenCalledWith('message', 'CSS content', callback);
        expect(callback).not.toHaveBeenCalled();
    });

    it("removes existing stylesheets", function () {
        source = '<?xml ?><svg><defs><style><![CDATA[xxx]]></style></defs><g><style /></g></svg>';
        loadInline([]);
        expect($xml('style').length).toBe(0);
    });

    it("applies rules", function () {
        loadInline(['g.one {prop: value} #obj2 {prop2: 2; prop3: 3}']);
        expect($xml('g.one').css('prop')).toBe('value');
        expect($xml('#obj2').css('prop2')).toBe('2');
        expect($xml('#obj2').css('prop3')).toBe('3');
    });

    it("prioritizes direct styles", function () {
        source = '<?xml ?><svg><defs/><g style="prop:value1;" class="one" id="obj1"/></svg>';
        loadInline(['#obj1, .one {prop: value2}']);
        expect($xml('#obj1').css('prop')).toBe('value1');
    });

    it("cascades styles", function () {
        loadInline([
            '#obj1 {prop: value1} g.one {prop: value2}',
            'g.two {prop: value1} .two {prop: value2}'
        ]);
        expect($xml('#obj1').css('prop')).toBe('value1');
        expect($xml('#obj2').css('prop')).toBe('value1');
        loadInline([
            'svg g.two {prop: value1} g:last-child {prop: value2}',
            'g.three {prop: value1}'
        ]);
        expect($xml('#obj1').css('prop')).toBeUndefined();
        expect($xml('#obj2').css('prop')).toBe('value1');
        loadInline([
            '#root g {prop: value1} g#obj1 {prop: value2}',
            '#root, #obj2 {prop: value3}'
        ]);
        expect($xml('#root').css('prop')).toBe('value3');
        expect($xml('#obj1').css('prop')).toBe('value2');
        expect($xml('#obj2').css('prop')).toBe('value1');
    });
});