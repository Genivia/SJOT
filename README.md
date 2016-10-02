
SJOT: Schemas for JSON Objects
==============================

by Robert van Engelen, engelen@genivia.com

More info:
http://genivia.com/sjot.html

Copyright (C) 2016, Robert van Engelen, Genivia Inc., All Rights Reserved
Released under the BSD3 license

JSON validation API
-------------------

sjot.js is a working version with some limitations:

- No @extends and @final
- No external type references "URI#type"
- No uniqueness check for sets
- Needs improved error handling

Usage:

    var obj = JSON.parse(text);

    if (SJOT.validate(obj))
      ... // obj validated against the embedded @sjot schema (if any)
   
    var schema = '{ "sometype": { ... } }';
   
    if (SJOT.validate(obj, "#sometype", schema))
      ... // obj validated against schema type sometype
   
    if (SJOT.validate(obj, "http://example.com/sjot.json#sometype"))
      ... // obj validated against schema type sometype from http://example.com/sjot.json

gSOAP JSON validation
---------------------

sjot.c and sjot.cpp initial release expected in October 2016.

