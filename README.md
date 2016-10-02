
SJOT: Schemas for JSON Objects
==============================

by Robert van Engelen, engelen@genivia.com

More info:
http://genivia.com/sjot.html

Released under the BSD3 license.

Copyright (C) 2016, Robert van Engelen, Genivia Inc., All Rights Reserved.

JSON validation API
-------------------

Usage:

    var obj = JSON.parse(text);

    if (SJOT.validate(obj))
      ... // obj validated against the embedded @sjot schema (if any)
   
    var schema = '{ "sometype": { ... } }';
   
    if (SJOT.validate(obj, "#sometype", schema))
      ... // obj validated against schema type sometype
   
    if (SJOT.validate(obj, "http://example.com/sjot.json#sometype"))
      ... // obj validated against schema type sometype from http://example.com/sjot.json

sjot.js is fully functional but the current version has some limitations:

- No @final check
- No external type references "URI#type"
- No uniqueness check for sets
- Needs improved error handling

gSOAP JSON validation
---------------------

sjot.c and sjot.cpp initial release expected in October 2016.

Changelog
---------

- Oct 1, 2016: sjot.js 0.0.2 released
- Oct 2, 2016: sjot.js 0.1.0 added @extends and fixed minor issues
