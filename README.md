
[![logo][logo-url]][sjot-url]

[![npm version][npm-image]][npm-url] [![build status][travis-image]][travis-url] [![license][bsd-3-image]][bsd-3-url]

SJOT: Schemas for JSON Objects
==============================

Schemas for JSON Objects, or simply SJOT, offers faster JSON validation and
type checking with lightweight schemas and compact validators.  SJOT schemas
have the look and feel of object templates and are easy to use.

Installation
------------

    npm install sjot

Highlights
----------

- Use SJOT to efficiently validate and type-check JSON and JS values with
  compact types and schemas.  SJOT schemas are compact and have the
  look-and-feel of JSON templates.

- JSON validation with `SJOT.valid(data, typeref, schema)` and
  `SJOT.validate(data, typeref, schema)` is fast: the worst-case running time
  is asymptotically linear in the size of the JSON value to validate.

- Type check JSON and JS values with `SJOT.valid(data, type)`.

- `SJOT.check(schema)` verifies a schema and its satisfiability, so you never
  have to worry about schemas with conflicting one/any/all/dep constraints that
  reject all data.

- SJOT schemas translate to JSON schema draft v4 without loss of schema details.

- Live SJOT validator, schema converters and snapSJOT creator at
  <https://www.genivia.com/get-sjot.html#demo>

- Full documentation at <http://sjot.org>

How to validate JSON
--------------------

Some examples to validate JSON and JS values with a SJOT schema:

```js
// <script src="sjot.js"></script>  add this to your web page to load sjot.js, or...
var SJOT = require("sjot");     //  ... use the npm sjot package for node.js

var schema = {
  "@root": {                    // root type is an object:
    "name":    "string",        // required name of type string
    "v?1.0":   "number",        // optional v with default 1.0
    "tags?":   "string{1,}",    // optional non-empty set of string tags
    "package": { "id": "1..", "name": "char[1,]" }
   }                            // package.id >= 1, non-empty package.name
};

var data = {
    "name":    "SJOT",
    "v":       1.4,
    "tags":    [ "JSON", "SJOT" ],
    "package": { "id": 1, "name": "sjot" }
  };

// example 1: SJOT.valid(data, type|"[URI]#[type]"|"@root", schema) tests if data is valid:

if (SJOT.valid(data, "@root", schema))
  ... // OK: data validated against schema
else
  ... // FAIL: data is not valid

// example 2: SJOT.validate(data, type|"[URI]#[type]"|"@root", schema) validates data, if validation fails throws an exception with diagnostics:

try {
  SJOT.validate(data, "@root", schema);
} catch (e) {
  window.alert(e); // FAIL: data is not valid
}

// example 3: SJOT.check(schema) checks if schema is compliant and correct and if it has satisfiable constraints (does not reject all data), if not throws an exception with diagnostics:

try {
  SJOT.check(schema);
} catch (e) {
  window.alert(e); // FAIL: schema is not compliant or is incorrect or is not satisfiable (see notes)
}
```

How to type check JSON and JS values
------------------------------------

Type checking JSON and JS values with SJOT is simple too with
`SJOT.valid(data, type)` that tests if `data` is of the correct `type`:

```js
// <script src="sjot.js"></script>  add this to your web page to load sjot.js, or...
var SJOT = require("sjot");     //  ... use the npm sjot package for node.js

var value1 = 2;
var value2 = true;
var value3 = [1,2];
var value4 = {a:"x",b:2};
var value5 = {a:[1,2],b:{"x":3.14}};

// examples: these all succeed to type check

if (SJOT.valid(value1, "1..10"))
  ... // OK (result is true)
if (SJOT.valid([value1,value2], ["1..10","boolean"]))
  ... // OK (result is true)
if (SJOT.valid(value3, ["int"]))
  ... // OK (result is true)
if (SJOT.valid(value4, {a:"char[1]",b:"1..10"}))
  ... // OK (result is true)
if (SJOT.valid(value5, {"@final":true,a:["int"],b:{x:"float"}}))
  ... // OK (result is true)

// examples: these fail to type check

if (SJOT.valid(value1, "-1..0") === false)
  ... // FAIL (result is false)
if (SJOT.valid(value2, "number") === false)
  ... // FAIL (result is false)
if (SJOT.valid(value3, "int[3,5]") === false)
  ... // FAIL (result is false)
if (SJOT.valid(value4, {x:"number"}) === false)
  ... // FAIL (result is false)
if (SJOT.valid(value5, {"@final":true,a:["int"]}))
  ... // OK (result is true)
```

How to snapSJOT JSON
--------------------

SnapSJOT creates a SJOT schema for the given JSON data.  First, install
snapSJOT with:

    npm install snapsjot

Then use snapSJOT with node.js as follows:

```js
var snapSJOT = require("snapsjot");
var data =
[
  {
    "name":    "SJOT",
    "v":       "1.3.7",
    "tags":    [ "JSON", "SJOT", "validator" ],
    "package": { "id": 1, "name": "sjot" }
  },
  {
    "name":    "SNAPSJOT",
    "v":       1.3,
    "tags":    [ "JSON", "SJOT", "converter" ],
    "package": { "id": 2, "name": "snapsjot", "opt": true }
  }
];
var schema = snapSJOT.convert(data);
console.log(JSON.stringify(schema, null, 2));
```

This creates the following SJOT schema:

```js
{
  "@note": "SJOT schema created from JSON data by snapSJOT",
  "@root": [
    {
      "@final": true,
      "name": "string",
      "v": [[ "string", "number" ]],
      "tags": [ "string" ],
      "package": {
        "@final": true,
        "id": "number",
        "name": "string",
        "opt?": "boolean"
      }
    }
  ]
}
```

SJOT schema basics
------------------

A SJOT schema is a dictionary of named types, with `@root` defining the root
type of the JSON document to validate:

    {
      "@root":     type,
      "SomeType":  type,
      "OtherType": type,
      ...
    }

A SJOT type is one of:

    "any"                 any type (wildcard)
    "atom"                non-null primitive type
    "boolean"             Boolean
    "true"                fixed value true
    "false"               fixed value false
    "byte"                8-bit integer
    "short"               16-bit integer
    "int"                 32-bit integer
    "long"                64-bit integer
    "ubyte"               8-bit unsigned integer
    "ushort"              16-bit unsigned integer
    "uint"                32-bit unsigned integer
    "ulong"               64-bit unsigned integer
    "integer"             integer (unconstrained)
    "float"               single precision decimal
    "double"              double precision decimal
    "number"              decimal number (unconstrained)
    "n,m,..."             numeric enumeration
    "n..m"                inclusive numeric range (n or m is optional)
    "<n..m>"              exclusive numeric range (n or m is optional)
    "string"              string
    "base64"              string with base64 content
    "hex"                 string with hexadecimal content
    "uuid"                string with UUID content
    "date"                string with RFC 3339 date
    "time"                string with RFC 3339 time
    "datetime"            string with RFC 3339 datetime
    "duration"            string with ISO-8601 duration
    "char"                string with a single character
    "char[n,m]"           string of n to m characters (n, m are optional)
    "(regex)"             string that matches the regex (regex is anchored)
    "type[]"              array of values of named type
    "type[n,m]"           array of n to m values of named type (n, m are optional)
    "type{}"              set of atoms (array of unique atoms)
    "type{n,m}"           set of n to m atoms (n, m are optional)
    "URI#name"            reference to named type in schema "@id": "URI"
    "#name"               reference to named type in current schema
    "object"              object, same as {}
    "array"               array, same as []
    "null"                fixed value null
    [ type ]              array of values of type (type is optional)
    [ n, type, m ]        array of n to m values of type (n, type, m are optional)
    [ type, ..., type ]   tuple of typed values
    [[ type, ..., type ]] union (choice) of types
    { "prop": type, ... } object with typed properties

An object property is optional when its name ends with a `?`, which may be
followed by a default value for the property.  This default value will be
assigned by the validator when the property is not present in the object or is
null.

An object property name can be expressed as a regex string "(regex)" for
property name matching.  The regex is anchored.

Constraints on objects are expressed with `@extends`, `@final`, `@one`, `@any`,
`@all`, `@dep`.

Notes can be placed in schemas and objects with `@note` property strings.

SJOT explained by example
-------------------------

### Arrays and objects

An array of non-extensible (final) address objects with required number,
street, city, state and zip, and an optional phone number specified as a regex:

    {
      "@root": [
        {
          "@final": true,
          "number": "1..",
          "street": "char[1,]",
          "city":   "char[1,]",
          "state":  "char[2]",
          "zip":    "10000..99999",
          "phone?": "([- 0-9]+)"
        }
      ]
    }

### Default values

When an optional property is missing or is null, the default value will be
assigned by the validator to this property.  For example, an object with an
optional year since 1900 that defaults to 1900:

    {
      "@root": { "year?1900": "1900.." }
    }

### Inheritance and referencing

An array of extensible products and widgets, where `Widget` extends `Product`.
Note that `#Product` references a named type in the schema:

    {
      "@root": [ "#Product" ],

      "Product": {
        "SKU":   "100..",
        "name":  "string",
        "price": "<0.0.."
      },

      "Widget": {
        "@extends": "#Product",
        "dimensions": {
          "length": "number",
          "width":  "number",
          "height": "number"
        }
      }
    }

### Dependence

Dependences are specified with `@dep` (meaning that if a property is present
then other(s) must be present), `@one` (exactly one of the properties must be
present), `@any` (one or more of the properties must be present), and `@all`
(none or all of the properties must be present).  For example, if property
`contest` is present then property `prizes` must also be present as specified
with `@dep`, where `prizes` is a non-empty array of unique strings:

    {
      "@root": {
        "event":    "string",
        "contest?": "string",
        "prizes?":  "string{1,}",
        "@dep": {
          "contest": [ "prizes" ]
        }
      }
    }

### Union

A non-empty array of mixed strings and numbers:

    {
      "@root": [1, [["string", "number"]] ]
    }

### Regex

A regex property name or string type opens with `(` and ends with `)` and is
implicitly anchored with a `^` and a `$`.  For example, an extensible
dictionary object of word-word pairs:

    {
      "@root": { "(\\w+)", "(\\w+)" }
    }

What's included?
----------------

Three alternative versions of `sjot.js` are included:

- `sjot-fast.js` is optimized for speed but validation error messages are less informative
- `sjot-lean.js` is optimized for size but lacks `SJOT.check(schema)`
- `sjot-mean.js` is optimized for speed and size

Also included are the following utilities:

- `dev/sjot2js.js` is a SJOT to JSON schema converter.
- `dev/js2sjot.js` is a JSON schema to SJOT converter.
- `dev/snapsjot.js` is the snapSJOT schema creator from JSON data.

You can use these utilities interactively at
<https://www.genivia.com/get-sjot.html#demo>

How does SJOT compare to JSON schema?
-------------------------------------

- JSON schema is **verbose**, doubling the nesting level compared to JSON data.
  By contrast, SJOT schema levels are one-on-one with JSON data.
- JSON schema validation performance is **not scalable**.  By contrast, SJOT
  validators are very fast and scalable.  The asymptotic running time of JSON
  validity checking is linear in the size of the given JSON data.
- JSON schema offers very **few predeclared primitive types**.  By contrast,
  SJOT offers a wide choice of pre-defined types.
- JSON schema is **non-strict by default**.  By contrast, SJOT is strict by
  default since object properties are required by default.
- JSON schemas are **not extensible**.  By contrast, SJOT objects are
  extensible or final.
- JSON schema **violates the encapsulation principle** because it permits
  referencing local schema types.  By contrast, SJOT groups all types at the
  top level in the schema as a simple dictionary of named types.
- JSON schema design **violates the orthogonality principle**.  There should
  only be one simple and independent way to combine constructs.
- The **principle of least surprise** may not apply to JSON schema.

Limitations
-----------

`sjot.js` is fully functional to validate JSON data, with one minor practical
limitation:

- The SJOT model checker `SJOT.check()` checks schema satisfiability for up to
  20 distinct properties collected from the `@one`, `@any`, `@all`, and `@dep`
  of an object type. The model checker stays silent for over 20 properties due
  to the excessive computational expense (the model satisfiability problem is
  NP-complete).  The model checker is optional and is not used by the SJOT
  validator.

Feature wish list / nice to have
--------------------------------

- Random JSON data generator from SJOT schemas for testing

How to contribute?
------------------

We love feedback and contributions to this project.  Please read
[CONTRIBUTING](CONTRIBUTING.md) for details.

Changelog
---------

- Oct  1, 2016: sjot 0.0.2 released
- Oct  2, 2016: sjot 0.1.0 added `@extends` and fixed minor issues
- Oct  3, 2016: sjot 0.1.1 fixes for minor issues
- Oct  3, 2016: sjot 0.1.2 fixes for minor issues
- Oct  3, 2016: sjot 0.1.3 fixed JS RegExp features not supported by Safari
- Oct  4, 2016: sjot 0.1.4 added `@final`, added validation error reporting, fixed minor issues
- Oct  5, 2016: sjot 0.1.5 minor fixes
- Oct  5, 2016: sjot 0.1.6 API update: `SJOT.valid(data)` returns true (valid) or false (invalid), `SJOT.validate(data)` throws exception string with error details when validation fails
- Oct  6, 2016: sjot 0.1.7 improvements and fixes for minor issues
- Oct  7, 2016: sjot 1.0.0 added `SJOT.check(schema)`, uniqueness check for sets, and many other additions and improvements that makes the API compliant with the SJOT specification (except for support for external URL#name schema references)
- Oct  8, 2016: sjot 1.0.2 fixes for minor issues
- Oct  9, 2016: sjot 1.0.4 fixes for minor issues
- Oct 10, 2016: sjot 1.1.0 fast, lean, and mean scripts included
- Oct 11, 2016: sjot 1.1.1 datetime RFC3339 validation fixed
- Oct 12, 2016: sjot 1.2.0 regex property names added
- Oct 13, 2016: sjot 1.2.1 fixes numeric range validation issue (float data for integer range type is invalid)
- Oct 18, 2016: sjot 1.2.2 fix for `SJOT.check()` `#type` cycling and added `"null"` type
- Oct 19, 2016: sjot 1.2.3 updated `SJOT.check()` for union types and validation rules
- Oct 20, 2016: sjot 1.2.4 improved handling of default values for properties and tuples with nulls, so that the validator adds default values in place of missing data
- Oct 21, 2016: sjot 1.2.5 improvements and dev/sjot2js.js added
- Oct 22, 2016: sjot 1.2.6 added new `@dep` constraints and new built-in `"true"` and `"false"` types
- Oct 24, 2016: sjot 1.2.7 added SJOT schema model checker to `SJOT.check()` that checks for non-satisfiable schemas which reject all data
- Oct 25, 2016: sjot 1.2.8 minor updates
- Oct 25, 2016: sjot 1.2.9 minor updates
- Nov 22, 2016: sjot 1.3.0 merged dev/js2sjot thanks to Chris Moutsos for helping out
- Nov 25, 2016: sjot 1.3.1 added `"uuid"` type and inline arrays with `[type]` and `[n,type,m]`
- Nov 26, 2016: sjot 1.3.2 fixes for minor issues
- Nov 28, 2016: sjot 1.3.3 performance improvements, fixes for minor issues
- Nov 29, 2016: sjot 1.3.4 added support for schema root references `URI#` and `#` in addition to `URI#type` and `#type`, root references may also be used in `@sjot` in JSON
- Dec  1, 2016: sjot 1.3.5 improvements
- Dec 12, 2016: sjot 1.3.6 improvements
- Jan  9, 2017: sjot 1.3.7 added remote SJOT schema loading (subject to Same Origin Policy)
- Feb 13, 2017: sjot 1.3.8 improvements
- Jul  8, 2017: sjot 1.3.9 improvements
- Jul  9, 2017: sjot 1.3.10 improvements
- Jul  9, 2017: sjot 1.3.11 improvements
- Jul 12, 2017: sjot 1.3.12 validation error messages now use JSONPath to identify JSON error locations
- Jul 12, 2017: sjot 1.3.13 improvements
- Jul 13, 2017: sjot 1.3.14 updated js2sjot.js
- Jul 16, 2017: sjot 1.3.15 improvements
- Oct 24, 2017: sjot 1.3.16 ES5 compatible sjot.js update for improved browser support
- Nov 14, 2017: sjot 1.3.17 added snapSJOT snapsjot.js schema creator to convert JSON data to SJOT schemas, improvements
- Nov 15, 2017: sjot 1.3.18 npm package snapsjot released
- Nov 16, 2017: sjot 1.4.0  sjot and snapsjot updates, easy type checking with `SJOT.valid(data, type)`, removed `console.log()`

[logo-url]: https://www.genivia.com/images/sjot-logo.png
[sjot-url]: http://sjot.org
[npm-image]: https://badge.fury.io/js/sjot.svg
[npm-url]: https://www.npmjs.com/package/sjot
[travis-image]: https://travis-ci.org/Genivia/SJOT.svg?branch=master
[travis-url]: https://travis-ci.org/Genivia/SJOT
[bsd-3-image]: https://img.shields.io/badge/license-BSD%203--Clause-blue.svg
[bsd-3-url]: https://opensource.org/licenses/BSD-3-Clause
[testling-image]: https://ci.testling.com/genivia-inc/SJOT.png
[testling-url]: https://ci.testling.com/genivia-inc/SJOT
