
[![logo][logo-url]][sjot-url]

[![npm version][npm-image]][npm-url] [![build status][travis-image]][travis-url]

SJOT: Schemas for JSON Objects
==============================

Schemas for JSON Objects, or simply SJOT, is a more compact alternative to JSON
schema.  SJOT schemas are valid JSON, just like JSON schema.  SJOT schemas
have the look and feel of an object template and are more easy to read and
understand.  SJOT aims at fast JSON data validation with lightweight schemas
and compact validators.

SJOT schemas convert to JSON schema draft v4 without loss of schema details.

Live validator and converter at <https://genivia.com/get-sjot.html#demo>

Read more at <http://sjot.org>

Install:

    npm install sjot

Released under the BSD3 license.
Copyright (C) 2016, Robert van Engelen, Genivia Inc, All Rights Reserved.

JSON validation JS API
----------------------

Usage:

```js
// <script src="sjot.js"></script>    add this to your web page to load sjot.js
var SJOT = require("sjot");     //    or use the npm sjot package for node.js

var schema = {
  "Data": {
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

// SJOT.valid(data [, type [, schema ] ]) tests if data is valid:

if (SJOT.valid(data, "#Data", schema))
  ... // OK: data validated against schema

if (SJOT.valid(data, "http://example.com/sjot.json#Data"))
  ... // OK: data validated against schema type Data from http://example.com/sjot.json

if (SJOT.valid(data))
  ... // OK: self-validated data against its embedded @sjot schema (only if a @sjot is present in data)

// SJOT.validate(data [, type [, schema ] ]) validates data, if validation fails throws an exception with diagnostics:
try {
  SJOT.validate(data, "#Data", schema);
} catch (e) {
  window.alert(e); // FAIL: validation failed
}

// SJOT.check(schema) checks if schema is compliant and correct, if not throws an exception with diagnostics:
try {
  SJOT.check(schema);
} catch (e) {
  window.alert(e); // FAIL: schema is not compliant or correct
}
```

Notes
-----

Three alternative versions of sjot.js are included:

- sjot-fast.js is optimized for speed but validation error messages are less informative
- sjot-lean.js is optimized for size but lacks `SJOT.check(schema)`
- sjot-mean.js is optimized for speed and size

dev/sjot2js.js is a SJOT to JSON schema converter that will eventually be
integrated into the SJOT class. Visit <https://genivia.com/get-sjot.html#demo>
to use the converter.

sjot.js is fully functional to validate JSON data, but the current version has
some limitations:

- For security reasons, no loading of external type references "URI#type" yet (where URI is a URL of a schema to load)

JSON validation C/C++ API
-------------------------

sjot.c and sjot.cpp initial release for gSOAP is expected in October 2016.

Feature wish list / nice to have
--------------------------------

- JSON schema to SJOT converter (work in progres)
- Performance improvements (our currrent focus is on accuracy)
- Random JSON data generator from SJOT schemas for testing

Changelog
---------

- Oct  1, 2016: sjot.js 0.0.2 released
- Oct  2, 2016: sjot.js 0.1.0 added @extends and fixed minor issues
- Oct  3, 2016: sjot.js 0.1.1 fixes for minor issues
- Oct  3, 2016: sjot.js 0.1.2 fixes for minor issues
- Oct  3, 2016: sjot.js 0.1.3 fixed JS RegExp features not supported by Safari
- Oct  4, 2016: sjot.js 0.1.4 added @final, added validation error reporting (on the console), fixed minor issues
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
- Oct 18, 2016: sjot.js 1.2.2 fix for SJOT.check #type cycling and "null" type
- Oct 19, 2016: sjot.js 1.2.3 updated union SJOT.check and validation rules
- Oct 20, 2016: sjot.js 1.2.4 improved handling of default values for properties and tuples with nulls, so that the validator adds default values in place of missing data
- Oct 21, 2016: sjot.js 1.2.5 improvements and dev/sjot2js.js added

[logo-url]: https://www.genivia.com/images/sjot-logo.png
[sjot-url]: http://sjot.org
[npm-image]: https://badge.fury.io/js/sjot.svg
[npm-url]: https://www.npmjs.com/package/sjot
[travis-image]: https://travis-ci.org/Genivia/SJOT.svg?branch=master
[travis-url]: https://travis-ci.org/Genivia/SJOT
