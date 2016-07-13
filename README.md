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

+ **load(fn, callback)**
  load a svg file for editing and/or exporting from  

  `string fn` qualified file name  

  `function callback (err)` node-style callback function, no data.

+ **stylize(opt, callback)**  
  write stylesheets into the loaded file; all pre-existing style sheets are removed  

  `Object opt` options in the format
  ```
  {
      src: string | string[], // single .css or .scss file name or Array of
                              // file names
      sassOptions: [Object]   // node-sass compiler options, excluding file,
                              // data and sourceMap. Note that includePaths
                              // defaults to the respective directory of each
                              // file if omitted
  }
  ```  

  `function callback (err)` node-style callback function, no data.

+ **inline(opt, callback)**  
  distribute all styles from the style sheets of the loaded file
  to inline style attributes. Note that @-rules are ignored; the `<style>`
  elements are subsequently removed.  

  `Object opt` options in the format
  ```
  {
      src: string | string[], // single .css or .scss file name or Array of
                              // extra stylesheet(s) to apply before each
                              // internal stylesheet
      sassOptions: [Object]   // node-sass compiler options, excluding file,
                              // data and sourceMap. Note that includePaths
                              // defaults to the respective directory of each
                              // file if omitted
  }
  ```  

  `function callback (err)` node-style callback function, no data.

+ **write(targetFn, callback)**  
  write the loaded file to a target file  

  `string targetFn` qualified file name  

  `function callback (err)` node-style callback function, no data.

+ **export(opt, callback)**  
  export a list of objects from the loaded file to separate icon files  

   `Object opt` options in the format
  ```
  {
      ids: string[],          // list of object ids to export
      format: string,         // svg of png
      dir: string,            // directory to write to, defaults to "."
      postfix: [string],      // name exported files in the form
                              // ${id}${postfix}.${format}
      exportOptions: [Object]
  }
  ```  
  The `exportOptions` option differs according to `format`:
  + for Png, the following inkscape `--export-${cmd}` command line options
    are permissible: `background`, `background-opacity`, `use-hints`, `dpi`,
    `text-to-path`, `ignore-filters`, `width` and `height`.
  + for Svg, `width`, `height` and `preserveAspectRatio` can be set as attributes
    of the root svg element. The viewBox attribute will be set to the bounding
    box of the exported object.

  `function callback (err)` node-style callback function, no data.

