"use strict";

var css = require('css');
var specificity = require('specificity');

var utils = require('./utils.js');

var $, $styled;

// loop function that passes over comments or @-rules from the css parse tree
function forEachFiltered (prop, obj, callback) {
    var props = prop + 's';
    obj[props].filter((item) => {
        return item.type === prop;
    }).forEach(callback);
}

// reverse sort function
function sortSpecificity (arr) {
    function compare (a1, a2) {
        var v1 = a1.shift(), v2 = a2.shift();
        if (v1 !== v2) {
            return v2 - v1;
        } else if (a1.length === 0) {
            return 1;
        } else {
            return compare(a1, a2);
        }
    }
    
    return arr.sort((selector1, selector2) => {
        var a1 = specificity.calculate(selector1)[0].specificityArray;
        var a2 = specificity.calculate(selector2)[0].specificityArray;
        return  compare(a1, a2);
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

// store the style properties of every applicable selector with the element
function listSelectors (rule) {
    rule.selectors.forEach((selector) => {
        var $selected = $(selector);
        if ($selected.length) {
            $selected.data(selector, rule);
            // cache elements with style rules
            $styled = $styled.add($selected);
        }
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
        return utils.handleErr(err.message, 'CSS content', callback);
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
