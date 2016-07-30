# svg-icon-toolbox

A toolbox for svg icon and style assets workflows. This is still
work in progress.

## Usage

```js
var toolbox = require('svg-icon-toolbox');

toolbox.batch('tests/adhoc/assets.svg', [
    { task: 'stylize', arg: {src: 'src/sass/assets.scss'} },
    { task: 'write', arg: 'src/assets.svg' },
    { task: 'export', arg: {
        ids: list,
        format: 'png',
        dir: 'assets/'
        exportOptions: { dpi: 180 }
    } }
], callback);
```

## API

<a name="module_toolbox"></a>

## toolbox
<a name="module_toolbox.load"></a>

### `toolbox.load(sourceFn, callback)` ⇒
Load a svg file for editing and/or exporting from.

**Returns**: void  

| Param | Type | Description |
| --- | --- | --- |
| sourceFn | <code>string</code> | qualified file name |
| callback | <code>[callback](#module_toolbox..callback)</code> | node style callback gets the     [Loaded](#Loaded) object. |

<a name="module_toolbox.batch"></a>

### `toolbox.batch(sourceFn, tasks, callback)` ⇒
Load and batch process a svg file.

**Returns**: void  

| Param | Type | Description |
| --- | --- | --- |
| sourceFn | <code>string</code> | qualified file name |
| tasks | <code>Array.&lt;Object&gt;</code> | a series of tasks to perform in the loaded file |
| tasks.task | <code>string</code> | name of a Loaded method |
| tasks.arg | <code>string</code> &#124; <code>Object</code> | the first argument for that method (either a     file name or an options object) |
| callback | <code>[callback](#module_toolbox..callback)</code> | node style callback gets the     [Loaded](#Loaded) object. |

<a name="module_toolbox..callback"></a>

### `toolbox~callback(error, loaded)` ⇒
**Returns**: void  

| Param | Type |
| --- | --- |
| error | <code>any</code> | 
| loaded | <code>[Loaded](#Loaded)</code> | 

<a name="Loaded"></a>

## Loaded
<a name="Loaded+$"></a>

### `loaded.$` : <code>Cheerio</code>
the loaded file represented as a
[cheerio](https://github.com/cheeriojs/cheerio) object

<a name="Loaded+sourceFn"></a>

### `loaded.sourceFn` : <code>string</code>
the name of the loaded file

<a name="Loaded+stylize"></a>

### `loaded.stylize(opt, callback)` ⇒
Write stylesheets into the loaded file; all pre-existing style sheets are removed.

**Returns**: void  

| Param | Type | Description |
| --- | --- | --- |
| opt | <code>Object</code> |  |
| opt.src | <code>string</code> &#124; <code>Array.&lt;string&gt;</code> | single .css or .scss file name or Array of file names |
| [opt.sassOptions] | <code>Object</code> | node-sass compiler options, excluding file,     data and sourceMap. Note that `includePaths` defaults to the respective     directory of each file if omitted |
| callback | <code>[callback](#module_toolbox..callback)</code> | node style callback gets the     [Loaded](#Loaded) object. |

<a name="Loaded+inline"></a>

### `loaded.inline(opt, callback)` ⇒
Distribute all styles from the style sheets of the loaded file
to inline style attributes. Note that @-rules are ignored; the `<style>`
elements are subsequently removed.

**Returns**: void  

| Param | Type | Description |
| --- | --- | --- |
| opt | <code>Object</code> |  |
| opt.src | <code>string</code> &#124; <code>Array.&lt;string&gt;</code> | single .css or .scss file name or Array of file      names of extra stylesheet(s) to apply before each internal stylesheet |
| [opt.sassOptions] | <code>Object</code> | node-sass compiler options, excluding file,     data and sourceMap. Note that `includePaths` defaults to the respective     directory of each file if omitted |
| callback | <code>[callback](#module_toolbox..callback)</code> | node style callback gets the     [Loaded](#Loaded) object. |

<a name="Loaded+write"></a>

### `loaded.write([targetFn], callback)` ⇒
Write the loaded file to a target file.

**Returns**: void  

| Param | Type | Description |
| --- | --- | --- |
| [targetFn] | <code>string</code> | qualified file name. Defaults to overwriting     the source of the loaded file. |
| callback | <code>[callback](#module_toolbox..callback)</code> | node style callback gets the     [Loaded](#Loaded) object. |

<a name="Loaded+export"></a>

### `loaded.export(opt, callback)` ⇒
Export a list of objects from the loaded file to separate icon files.

**Returns**: void  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| opt | <code>Object</code> |  |  |
| opt.ids | <code>Array.&lt;string&gt;</code> |  | list of object ids to export |
| opt.format | <code>string</code> |  | png or svg |
| [opt.dir] | <code>string</code> | <code>&quot;.&quot;</code> | directory to write to |
| [opt.postfix] | <code>string</code> |  | name exported files in the form     `${id}${postfix}.${format}` |
| [opt.postProcess] | <code>string</code> &#124; <code>function</code> |  | executed on the     exported file. If a string, as a CLI command, if a function, directly.     Both get the qualified file name as argument. A function should have     the form `(fileName, callback) => void` and execute the callback with     `(err)`. |
| [opt.exportOptions] | <code>Object</code> |  | for Png, the following `inkscape --export-${cmd}` command line options       are permissible: background, background-opacity, use-hints, dpi,       text-to-path, ignore-filters, width and height.<br/>     for Svg, `width`, `height` and `preserveAspectRatio` can be set as attributes       of the root svg element. The `viewBox` attribute will be set to the bounding       box of the exported object. |
| callback | <code>[callback](#module_toolbox..callback)</code> |  | node style callback gets the     [Loaded](#Loaded) object. |

