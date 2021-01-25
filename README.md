# Reactive Tables
An experimental browser-based spreadsheet application, with some unusual features.

## Demo

[Live Demo](https://luka.doublebuffer.net/o/reactive_tables/)

Playing with reactive functions: [table](https://www.youtube.com/watch?v=6iThXbloqz0), [complex functions](https://www.youtube.com/watch?v=NGcDIkKlBUs)


## Why

- JavaScript enables much more complex formulas than what the standard spreadsheets allow.
- I always wanted to use Vue.js to build a spreadsheet reactivity engine. This was made possible with Vue 3. I wrote an [article](https://www.toptal.com/vue-js/on-demand-reactivity-vue-3) about this.
- Vue 3's powerful reactivity engine enables fancy experimental features, such as reactive functions.

## Features:
 - inputting data and formulas;
 - moving around the sheet with keyboard and mouse (`enter` or `double click` to edit, `esc` when done);
 - selection: 
    - single cells (`left click`), 
    - blocks (`shift` + `arrow key` or `shift` + `left click` or `mouse drag`),
    - multiple cells and/or blocks (`ctrl` + any of the above);
 - spreading content in rows/columns/blocks (inline cell menu);
 - copying and pasting selection (tab-separated columns, interoperable with other tools);
 - value formulas such as `SIN` and `COS`, and range formulas such as `SUM`;
 - reactive functions: define a function with `= MAP(name, function)`, call it somewhere, change the function, the results are updated immediately.

Note that although the computation engine is very fast as it is based on Vue 3, most other things are not optimised. 