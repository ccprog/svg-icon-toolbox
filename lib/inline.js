"use strict";

var css = require('css');
var specificity = require('specificity');

var utils = require('./utils.js');

var $, $styled;

// loop function that passes over comments or @-rules from the css parse tree
function forEachFiltered (prop, obj, callback) {
    /* jshint validthis:true */
    var props = prop + 's';
    obj[props].filter((item) => {
        return item.type === prop;
    }).forEach(callback, this);
}

// reverse sort function
function sortSpecificity (arr) {
    return arr.sort((selector1, selector2) => {
        return  specificity.compare(selector2, selector1) || 1;
    });
}

// apply style properties in order of specificity
function applyRules (i, el) {
    var $el = $(el);
    var sorted = sortSpecificity(Object.keys($el.data()));
    sorted.forEach((selector) => {
        var rule = $el.data(selector);
        forEachFiltered('declaration', rule, (declaration) => {
            //highest specificity gets written first, later declarations fall through
            if (!$el.css(declaration.property)) {
                $el.css(declaration.property, declaration.value);
            }
        });
    });
}

// compare property declarations and use the latest
function mergeDeclarations (newDecl) {
    /* jshint validthis:true */
    var pos = this.findIndex((oldDecl) => {
        return oldDecl.property === newDecl.property;
    });
    if (pos >= 0) {
        this.splice(pos, 1, newDecl);
    } else {
        this.push(newDecl);
    }
}

// store the style properties of every applicable selector with the element
function listSelectors (rule) {
    rule.selectors.forEach((selector) => {
        var $selected = $(selector);
        $selected.each((i, elem) => {
            var $elem = $(elem);
            // identical selectors may appear multiple times
            if ($elem.data(selector)) {
                forEachFiltered.call($elem.data(selector).declarations, 'declaration', rule, mergeDeclarations);
            } else {
                $elem.data(selector, rule);
            }
        });
        // cache elements with style rules
        $styled = $styled.add($selected);
    });
}

/**
 * distribute all styles from the style sheets of the loaded file
 * to inline style attributes. Note that @-rules are ignored; the <style>
 * elements are subsequently removed.
 * 
 * @template Cheerio
 * @param {Cheerio} $xml parsed Cheerio root object
 * @param {string[]} ruleset stylesheet texts
 * @param {function (any)} callback error callback
 * @return void
 */
module.exports = function ($xml, ruleset, callback) {
    $ = $xml;
    $styled = $();
    var result;

    //parse rules
    try {
        process.stdout.write('Parsing stylesheets...' );
        result = css.parse(ruleset.join('\n')).stylesheet;
        console.log('OK');
    } catch(err) {
        return utils.raiseErr(err, 'CSS content', callback);
    }

    if (result && result.rules.length) {
        forEachFiltered('rule', result, listSelectors);
        $styled.each(applyRules);
        console.log('Stylesheets applied.');
    } else {
        console.log('Nothing to apply.');
    }

    //remove all internal stylesheets
    var $styles = $('style');
    if ($styles.length) {
        $styles.remove();
        console.log('Stylesheet texts removed.');
    }
    return callback(null);
};
