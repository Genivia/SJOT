
[![logo][logo-url]][sjot-url]

[![npm version][npm-image]][npm-url] [![build status][travis-image]][travis-url] [![license][bsd-3-image]][bsd-3-url]

SJOT: Schemas for JSON Objects
==============================

Schemas for JSON Objects, or simply SJOT, is a more compact alternative to JSON
schema.  SJOT schemas are valid JSON, just like JSON schema.  SJOT schemas
have the look and feel of an object template and are more easy to read and
understand.  SJOT aims at fast JSON data validation with lightweight schemas
and compact validators.

SJOT schemas convert to JSON schema draft v4 without loss of schema details.

The `SJOT.check()` API runs a schema checker that verifies schema
satisfiability, so you never have to worry about schemas with conflicting
one/any/all/dep constraints that reject all data.

Live validator and converter at <https://www.genivia.com/get-sjot.html#demo>

Read more at <http://sjot.org>

Install:

    npm install sjot

Why another JSON schema "standard"?
-----------------------------------

- JSON schema is **verbose**, doubling the nesting level compared to JSON data.
  SJOT schema levels are one-on-one with JSON data.
- JSON schema validation performance is **not scalable**.  SJOT takes linear
  time to validate JSON data, linear in the size of the JSON data.
- JSON schema offers very **few predeclared primitive types**.  SJOT offers a
  wider choice of pre-defined types.
- JSON schema is **non-strict by default**.  SJOT is.
- JSON schemas are **not extensible**.  SJOT objects are extensible or final.
- JSON schema **violates the encapsulation principle** because it permits
  referencing local schema types.  SJOT groups all types that can be referenced
  at the top level in the root schema.
- JSON schema design **violates the orthogonality principle**.  There should
  only be a simple and independent way to combine constructs in schemas.
- The **principle of least surprise** may not apply to JSON schema.

SJOT does not suffer from any of these concerns.  SJOT defines schemas in
compact JSON.  SJOT is strict by default and supports object extensibility by
inheritance.  SJOT validators are very fast and scalable.  The asymptotic
running time of JSON validity checking is linear in the size of the JSON
content being verified.

JSON validation JS API
----------------------

Usage:

```js
// <script src="sjot.js"></script>    add this to your web page to load sjot.js
var SJOT = require("sjot");     //    or use the npm sjot package for node.js

var schema = {
  "Data": {                     // root of JSON data is a "Data" object
    "name":    "string",        // required name of type string
    "v?1.0":   "number",        // optional v with default 1.0
    "tags?":   "string{1,}",    // optional non-empty set of string tags
    "package": { "id": "1..", "name": "char[1,]" }
   }                            // package.id >= 1, non-empty package.name
};

var data = {
    "name":    "SJOT",
    "v":       1.1,
    "tags":    [ "JSON", "SJOT" ],
    "package": { "id": 1, "name": "sjot" }
  };

// SJOT.valid(data [, type|"[URI]#[type]"|"@root"|null [, schema ] ]) tests if data is valid:

if (SJOT.valid(data, "@root", schema))
  ... // OK: data validated against schema

if (SJOT.valid(data))
  ... // OK: self-validated data against its embedded @sjot schema (only if a @sjot is present in data, not in this example)

// SJOT.validate(data [, type|"[URI]#[type]"|"@root"|null [, schema ] ]) validates data, if validation fails throws an exception with diagnostics:
try {
  SJOT.validate(data, "@root", schema);
} catch (e) {
  window.alert(e); // FAIL: validation failed
}

// SJOT.check(schema) checks if schema is compliant and correct and if it has satisfiable constraints (does not reject all data), if not throws an exception with diagnostics:
try {
  SJOT.check(schema);
} catch (e) {
  window.alert(e); // FAIL: schema is not compliant or is incorrect or is not satisfiable (see notes)
}
```

Notes
-----

Three alternative versions of sjot.js are included:

- sjot-fast.js is optimized for speed but validation error messages are less informative
- sjot-lean.js is optimized for size but lacks `SJOT.check(schema)`
- sjot-mean.js is optimized for speed and size
- dev/sjot2js.js is a SJOT to JSON schema converter.  Visit
  <https://www.genivia.com/get-sjot.html#demo> to try the interactive converter.
- dev.js2sjot.js is a JSON schema to SJOT converter.

sjot.js is fully functional to validate JSON data, with some limitations:

- The SJOT model checker `SJOT.check()` checks schema satisfiability per object type for up to 20 distinct properties collected from the @one, @any, @all, and @dep of that object type. The model checker stays silent for over 20 properties (the model satisfiability problem is NP-complete).

JSON validation C/C++ API
-------------------------

sjot.c and sjot.cpp initial release for gSOAP is expected in 2017.

Feature wish list / nice to have
--------------------------------

- Random JSON data generator from SJOT schemas for testing
- Tool to generate SJOT schema from JSON data samples

Changelog
---------

- Oct  1, 2016: sjot.js 0.0.2 released
- Oct  2, 2016: sjot.js 0.1.0 added `@extends` and fixed minor issues
- Oct  3, 2016: sjot.js 0.1.1 fixes for minor issues
- Oct  3, 2016: sjot.js 0.1.2 fixes for minor issues
- Oct  3, 2016: sjot.js 0.1.3 fixed JS RegExp features not supported by Safari
- Oct  4, 2016: sjot.js 0.1.4 added `@final`, added validation error reporting, fixed minor issues
- Oct  5, 2016: sjot.js 0.1.5 minor fixes
- Oct  5, 2016: sjot.js 0.1.6 API update: `SJOT.valid(data)` returns true (valid) or false (invalid), `SJOT.validate(data)` throws exception string with error details when validation fails
- Oct  6, 2016: sjot.js 0.1.7 improvements and fixes for minor issues
- Oct  7, 2016: sjot.js 1.0.0 added `SJOT.check(schema)`, uniqueness check for sets, and many other additions and improvements that makes the API compliant with the SJOT specification (except for support for external URL#name schema references)
- Oct  8, 2016: sjot.js 1.0.2 fixes for minor issues
- Oct  9, 2016: sjot.js 1.0.4 fixes for minor issues
- Oct 10, 2016: sjot.js 1.1.0 fast, lean, and mean scripts included
- Oct 11, 2016: sjot.js 1.1.1 datetime RFC3339 validation fixed
- Oct 12, 2016: sjot.js 1.2.0 regex property names added
- Oct 13, 2016: sjot.js 1.2.1 fixes numeric range validation issue (float data for integer range type is invalid)
- Oct 18, 2016: sjot.js 1.2.2 fix for `SJOT.check()` `#type` cycling and added `"null"` type
- Oct 19, 2016: sjot.js 1.2.3 updated `SJOT.check()` for union types and validation rules
- Oct 20, 2016: sjot.js 1.2.4 improved handling of default values for properties and tuples with nulls, so that the validator adds default values in place of missing data
- Oct 21, 2016: sjot.js 1.2.5 improvements and dev/sjot2js.js added
- Oct 22, 2016: sjot.js 1.2.6 added new `@dep` constraints and new built-in `"true"` and `"false"` types
- Oct 24, 2016: sjot.js 1.2.7 added SJOT schema model checker to `SJOT.check()` that checks for non-satisfiable schemas which reject all data
- Oct 25, 2016: sjot.js 1.2.8 minor updates
- Oct 25, 2016: sjot.js 1.2.9 minor updates
- Nov 22, 2016: sjot.js 1.3.0 merged dev/js2sjot thanks to Chris Moutsos for helping out
- Nov 25, 2016: sjot.js 1.3.1 added `"uuid"` type and inline arrays with `[type]` and `[n,type,m]`
- Nov 26, 2016: sjot.js 1.3.2 fixes for minor issues
- Nov 28, 2016: sjot.js 1.3.3 performance improvements, fixes for minor issues
- Nov 29, 2016: sjot.js 1.3.4 added support for schema root references `URI#` and `#` in addition to `URI#type` and `#type`, root references may also be used in `@sjot` in JSON
- Dec  1, 2016: sjot.js 1.3.5 minor improvements
- Dec 12, 2016: sjot.js 1.3.6 minor improvements
- Jan  9, 2017: sjot.js 1.3.7 added remote SJOT schema loading (subject to Same Origin Policy)
- Feb 13, 2017: sjot.js 1.3.8 minor improvements
- Jul  8, 2017: sjot.js 1.3.9 minor improvements

[logo-url]: https://www.genivia.com/images/sjot-logo.png
[sjot-url]: http://sjot.org
[npm-image]: https://badge.fury.io/js/sjot.svg
[npm-url]: https://www.npmjs.com/package/sjot
[travis-image]: https://travis-ci.org/Genivia/SJOT.svg?branch=master
[travis-url]: https://travis-ci.org/Genivia/SJOT
[bsd-3-image]: https://img.shields.io/badge/license-BSD%203--Clause-blue.svg
[bsd-3-url]: https://opensource.org/licenses/BSD-3-Clause
