
SJOT: Schemas for JSON Objects
==============================

by Robert van Engelen, Genivia Inc, <engelen@genivia.com>

Released under the BSD3 license.
Copyright (C) 2016, Robert van Engelen, Genivia Inc., All Rights Reserved.

What is SJOT?
-------------

Schemas for JSON Objects, or simply SJOT, is a much simpler alternative to JSON
schema.  SJOT schemas are valid JSON, just like JSON schema.  But SJOT schemas
have the look and feel of an object template and are readable and
understandable by humans.  SJOT aims at quick JSON data validation with
lightweight schemas and compact validators.

Live demo at <http://genivia.com/js/test.html> (this demo is not interactive yet, but does execute a SJOT validator to validate example JSON data)

Read more at <http://www.sjot.org>

JSON validation JS API
----------------------

Example usage:

    var schema = '{ "Data": { "id": "string", "v": "number", "tags?": "string{1,}" } }';

    var text = '{ "id": "SJOT", "v": 1.0, "tags": [ "JSON", "SJOT" ] }';

    var obj = JSON.parse(text);


    // SJOT.valid(obj [, type [, schema ] ]) tests if the obj is valid:

    if (SJOT.valid(obj))
      ... // OK: self-validated obj against its embedded @sjot schema (only if a @sjot is present in obj)

    if (SJOT.valid(obj, "#Data", schema))
      ... // OK: obj validated against schema

    if (SJOT.valid(obj, "http://example.com/sjot.json#Data"))
      ... // OK: obj validated against schema type Data from http://example.com/sjot.json


    // SJOT.validate(obj [, type [, schema ] ]) throws an exception with diagnostics:

    try {
      SJOT.validate(obj, "#Data", schema);
    } catch (e) {
      window.alert(e); // validation failed
    }

    // check if schema is compliant and correct, throws an exception with diagnostics:
    SJOT.check(schema);

sjot.js is fully functional to validate JSON data, but the current version has
some limitations:

- No external type references "URI#type" yet (when URI is a URL of a schema to load)
- No uniqueness check for sets yet
- No `SJOT.check(schema)` yet

JSON validation C/C++ API
-------------------------

sjot.c and sjot.cpp initial release for gSOAP is expected in October 2016.

Changelog
---------

- Oct 1, 2016: sjot.js 0.0.2 released
- Oct 2, 2016: sjot.js 0.1.0 added @extends and fixed minor issues
- Oct 3, 2016: sjot.js 0.1.1 fixes for minor issues
- Oct 3, 2016: sjot.js 0.1.2 fixes for minor issues
- Oct 3, 2016: sjot.js 0.1.3 fixed JS RegExp features not supported by Safari
- Oct 4, 2016: sjot.js 0.1.4 added @final, added validation error reporting (on the console), fixed minor issues, remove `/*FAST[*/`...`/*]*/` parts to create faster validator by removing error report collection code
- Oct 5, 2016: sjot.js 0.1.5 minor fixes
- Oct 5, 2016: sjot.js 0.1.6 API update: `SJOT.valid(obj)` returns true (valid) or false (invalid), `SJOT.validate(obj)` throws exception string with error details when validation fails
