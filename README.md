# svg-icon-toolbox

A toolbox for svg icon and style assets workflows. This is still
work in progress.

## Usage

```js
var toolbox = require('svg-icon-toolbox');
var eachSeries = require('async').eachSeries;

eachSeries([
    { task: 'load', arg: 'src/assets.svg' },
    { task: 'stylize', arg: {src: 'src/sass/assets.scss'} },
    { task: 'write', arg: 'src/assets.svg' },
    { task: 'export', arg: {
        ids: list,
        format: 'png',
        dir: 'assets/'
        exportOptions: { dpi: 180 }
    } }
], (item, callback) => {
    toolbox[item.task](item.arg, callback);
});
```

## API

<a name="module_toolbox.load"></a>

### `toolbox.load(fn, callback)` ⇒
Load a svg file for editing and/or exporting from.

**Returns**: void  

| Param | Type | Description |
| --- | --- | --- |
| fn | <code>string</code> | qualified file name |
| callback | <code>function</code> | node style error callback `(any) => void` |

<a name="module_toolbox.stylize"></a>

### `toolbox.stylize(callback)` ⇒
Write stylesheets into the loaded file; all pre-existing style sheets are removed.<br/>
The callback will return an error if no file has been previously loaded.

**Returns**: void  

| Param | Type | Description |
| --- | --- | --- |
| opt.src | <code>string</code> &#124; <code>Array.&lt;string&gt;</code> | single .css or .scss file name or Array of file names |
| [opt.sassOptions] | <code>Object</code> | node-sass compiler options, excluding file,     data and sourceMap. Note that `includePaths` defaults to the respective     directory of each file if omitted |
| callback | <code>function</code> | node style error callback `(any) => void` |

<a name="module_toolbox.inline"></a>

### `toolbox.inline(callback)` ⇒
Distribute all styles from the style sheets of the loaded file
to inline style attributes. Note that @-rules are ignored; the `<style>`
elements are subsequently removed.<br/>
The callback will return an error if no file has been previously loaded.

**Returns**: void  

| Param | Type | Description |
| --- | --- | --- |
| opt.src | <code>string</code> &#124; <code>Array.&lt;string&gt;</code> | single .css or .scss file name or Array of file      names of extra stylesheet(s) to apply before each internal stylesheet |
| [opt.sassOptions] | <code>Object</code> | node-sass compiler options, excluding file,     data and sourceMap. Note that `includePaths` defaults to the respective     directory of each file if omitted |
| callback | <code>function</code> | node style error callback `(any) => void` |

<a name="module_toolbox.write"></a>

### `toolbox.write([targetFn], callback)` ⇒
Write the loaded file to a target file.<br/>
The callback will return an error if no file has been previously loaded.

**Returns**: void  

| Param | Type | Description |
| --- | --- | --- |
| [targetFn] | <code>string</code> | qualified file name. Defaults to overwriting     the source of the loaded file. |
| callback | <code>function</code> | node style error callback `(any) => void` |

<a name="module_toolbox.export"></a>

### `toolbox.export(callback)` ⇒
Export a list of objects from the loaded file to separate icon files.<br/>
The callback will return an error if no file has been previously loaded.

**Returns**: void  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| opt.ids | <code>Array.&lt;string&gt;</code> |  | list of object ids to export |
| opt.format | <code>string</code> |  | png or svg |
| [opt.dir] | <code>string</code> | <code>&quot;.&quot;</code> | directory to write to |
| [opt.postfix] | <code>string</code> |  | name exported files in the form     `${id}${postfix}.${format}` |
| [opt.postProcess] | <code>string</code> &#124; <code>function</code> |  | executed on the     exported file. If a string, as a CLI command, if a function, directly.     Both get the qualified file name as argument. A function should have     the form `(fileName, callback) => void` and execute the callback with     `(err)`. |
| [opt.exportOptions] | <code>Object</code> |  | for Png, the following `inkscape --export-${cmd}` command line options       are permissible: background, background-opacity, use-hints, dpi,       text-to-path, ignore-filters, width and height.<br/>     for Svg, `width`, `height` and `preserveAspectRatio` can be set as attributes       of the root svg element. The `viewBox` attribute will be set to the bounding       box of the exported object. |
| callback | <code>function</code> |  | node style error callback `(any) => void` |

