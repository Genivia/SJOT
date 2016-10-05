
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
lightweight validators.

Read more at <http://genivia.com/sjot.html>

JSON validation JS API
----------------------

Usage:

    var obj = JSON.parse(text);

    if (SJOT.validate(obj))
      ... // obj validated against the embedded @sjot schema (if any)
   
    var schema = '{ "sometype": { ... } }';
   
    if (SJOT.validate(obj, "#sometype", schema))
      ... // obj validated against schema type sometype
   
    if (SJOT.validate(obj, "http://example.com/sjot.json#sometype"))
      ... // obj validated against schema type sometype from http://example.com/sjot.json

    // check if schema is compliant and correct (throws an exception otherwise):
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
