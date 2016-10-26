/**
 * A validator for "Schemas for JSON Objects", or simply SJOT.
 * SJOT is a more compact alternative to JSON schema.  SJOT schemas are valid
 * JSON, just like JSON schema.  SJOT schemas have the look and feel of an
 * object template and are more easy to read and understand.  SJOT aims at
 * fast JSON data validation with lightweight schemas and compact validators.
 * (This initial release is not yet fully optimized for optimal performance.)
 *
 * @module      sjot
 * @version     {VERSION}
 * @class       SJOT
 * @author      Robert van Engelen, engelen@genivia.com
 * @copyright   Robert van Engelen, Genivia Inc, 2016. All Rights Reserved.
 * @license     BSD3
 * @link        http://sjot.org
 */


/*
   Usage

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

// SJOT.check(schema) checks if schema is compliant and correct and if it has satisfiable constraints (does not reject all data), if not throws an exception with diagnostics:
try {
  SJOT.check(schema);
} catch (e) {
  window.alert(e); // FAIL: schema is not compliant or is incorrect or is not satisfiable
}
 */

"use strict";

class SJOT {

  // valid(obj [, type [, schema ] ])
  static valid(obj, type, schema) {

    try {

      return this.validate(obj, type, schema);

    } catch (e) {

      /*LOG[*/ console.log(e); // report error /*LOG]*/
      return false;

    }

  }

  // validate(obj [, type [, schema ] ])
  static validate(obj, type, schema) {

    var sjots = schema;

    if (typeof schema === "string")
      sjots = JSON.parse(schema);

    if (type === undefined || type === null) {

      if (sjots === undefined || sjots === null)
        type = "any";
      else if (Array.isArray(sjots))
        type = sjot_roottype(sjots[0]);
      else if (typeof sjots === "object")
        type = sjot_roottype(sjots);
      else
        throw "SJOT schema expected but " + typeof sjots + " found";

    }

    if (Array.isArray(sjots))
      sjot_validate(sjots, obj, type, sjots[0] /**/);
    else
      sjot_validate([sjots], obj, type, sjots /**/);

    return true;

  }

  // check(schema)
  static check(schema) {

    var sjots = schema;

    if (typeof schema === "string")
      sjots = JSON.parse(schema);


  }

}

// one validation function that is tail recursive
function sjot_validate(sjots, data, type, sjot /**/) {

  if (type === "any") {

    if (typeof data === "object" && data !== null && data.hasOwnProperty('@sjot')) {

      // sjoot: validate this object using the embedded SJOT schema or schemas
      var sjoot = data['@sjot'];

      if (Array.isArray(sjoot))
        return sjot_validate(sjoot, data, sjot_roottype(sjoot[0]), sjoot[0] /**/);
      else
        return sjot_validate([sjoot], data, sjot_roottype(sjoot), sjoot/**/);

    }

    return;

  }

  if (typeof type === "string") {

    var h = type.indexOf("#");

    if (h >= 0 && !type.startsWith("(") && !(type.endsWith("]") || type.endsWith("}"))) {

      if (h === 0) {

        // validate non-id schema using the local type reference
        var prop = type.slice(h + 1);

        if (!sjot.hasOwnProperty(prop))
          throw "SJOT schema has no type " + prop + " referenced by " /**/ + type;
        return sjot_validate(sjots, data, sjot[prop], sjot /**/);

      } else {

        var prop = type.slice(h + 1);

        for (var sjoot of sjots) {

          if (sjoot.hasOwnProperty('@id') && type.startsWith(sjoot['@id']) && sjoot['@id'].length === h) {

            // validate with type reference if URI matches the @id of this SJOT schema
            if (!sjoot.hasOwnProperty(prop))
              throw "SJOT schema " + sjoot['@id'] + " has no type " + prop + " referenced by " /**/ + type;
            return sjot_validate(sjots, data, sjoot[prop], sjoot /**/);

          }

        }

        // TODO get external URI type reference when URI is a URL, load async and put in sjots array
        throw "No " + prop + " found that is referenced by " /**/ + type;

        return;

      }

    }

  }

  // check unions
  if (Array.isArray(type) && type.length === 1 && Array.isArray(type[0])) {

    // validate data against type union [[ type, type, ... ]]

    for (var itemtype of type[0]) {

      try {

        return sjot_validate(sjots, data, itemtype, sjot /**/);

      } catch (e) {
      

      }

    }

    sjot_error("value", data, type /**/);

  }

  switch (typeof data) {

    case "object":

      if (data === null || data === undefined) {

        if (data === null && type === "null")
          return;
        sjot_error("value", data, type /**/);

      } else if (Array.isArray(data)) {

        // validate an array
        if (type === "array" || type === "any[]")
          return;

        if (Array.isArray(type)) {

          // validate a tuple
          if (data.length != type.length)
            throw /**/ " length " + type.length;

          for (var i = 0; i < data.length; i++) {

            if (data[i] === null)
              data[i] = sjot_default("null", sjots, null, type[i], sjot /**/);
            sjot_validate(sjots, data[i], type[i], sjot /**/);
          }

          return;

        } else if (typeof type === "string") {

          if (type.endsWith("]")) {

            // validate an array
            var i = type.lastIndexOf("[");
            var itemtype = type.slice(0, i);

            sjot_validate_bounds(data.length, type, i + 1 /**/);

            for (var j = 0; j < data.length; j++) {

              if (data[j] === null)
                data[j] = sjot_default("null", sjots, null, type[j], sjot /**/);
              sjot_validate(sjots, data[j], itemtype, sjot /**/);

            }

            return;

          } else if (type.endsWith("}")) {

            // validate a set
            var i = type.lastIndexOf("{");
            var itemtype = type.slice(0, i);

            if (itemtype.indexOf("#") !== -1 && !itemtype.startsWith("(") && !(itemtype.endsWith("]") || itemtype.endsWith("}"))) {

              // get referenced URI#name type
              itemtype = sjot_reftype(sjots, itemtype, sjot /**/);
              if (typeof itemtype !== "string")
                sjot_error("value", data, type /**/);

            }

            // check uniqueness of items in the set
            var len = data.length;

            data = data.sort().filter(function (e, i, a) { return i === 0 || e !== a[i-1]; });
            if (data.length !== len)
              sjot_error("value", data, type /**/);

            sjot_validate_bounds(data.length, type, i + 1 /**/);

            for (var j = 0; j < data.length; j++) {

              if (data[j] === null)
                data[j] = sjot_default("null", sjots, null, type[j], sjot /**/);
              sjot_validate(sjots, data[j], itemtype, sjot /**/);

            }

            return;

          }

        }

        sjot_error("value", data, type /**/);

      } else {

        // validate an object
        if (type === "object") {

          // validate this object using the embedded @sjot, if present
          return sjot_validate(sjots, data, "any", sjot /**/);

        }

        if (type === "date" || type === "time" || type === "datetime") {

          // special case for JS (not JSON), check for Date object
          if (!data.constructor.name != "Date")
            sjot_error("value", data, type /**/);
          return;

        } else if (typeof type === "object") {

          // put @extends base properties into this object type
          if (type.hasOwnProperty('@extends'))
            sjot_extends(sjots, type, sjot /**/);

          var isfinal = type.hasOwnProperty('@final') && type['@final'];
          var props = {};

          // check object properties and property types
          for (var prop in type) {

            if (prop.startsWith("@")) {

              var proptype = type[prop];

              switch (prop) {

                case "@one":

                  for (var propset of proptype)
                    if (propset.reduce( function (sum, prop) { return sum + data.hasOwnProperty(prop); }, 0) !== 1)
                      throw datapath + " requires one of " + propset;
                  break;

                case "@any":

                  for (var propset of proptype)
                    if (!propset.some(function (prop) { return data.hasOwnProperty(prop); }))
                      throw datapath + " requires any of" + propset;
                  break;

                case "@all":

                  for (var propset of proptype)
                    if (propset.some(function (prop) { return data.hasOwnProperty(prop); }) &&
                        !propset.every(function (prop) { return data.hasOwnProperty(prop); }))
                      throw datapath + " requires all or none of " + propset;
                  break;

                case "@dep":

                  for (var name in proptype)
                    if (data.hasOwnProperty(name) &&
                        (typeof proptype[name] !== "string" || !data.hasOwnProperty(proptype[name])) &&
                        (typeof proptype[name] !== "object" || !proptype[name].every(function (prop) { return data.hasOwnProperty(prop); })))
                      throw datapath + "/" + name + " requires " + proptype[name];
                  break;

              }

            } else if (prop.startsWith("(")) {

              // regex property name
              var proptype = type[prop];
              var matcher = RegExp("^" + prop + "$");

              for (var name in data) {

                if (data.hasOwnProperty(name) && matcher.test(name)) {

                  sjot_validate(sjots, data[name], proptype, sjot /**/);
                  if (isfinal)
                    props[name] = null;

                }

              }


            } else {

              var i = prop.indexOf("?");

              if (i === -1) {

                // validate required property
                if (!data.hasOwnProperty(prop))
                  throw datapath + "/" + prop + " is required by " /**/ + prop;
                sjot_validate(sjots, data[prop], type[prop], sjot /**/);
                if (isfinal)
                  props[prop] = null;

              } else {

                var name = prop.slice(0, i);

                // validate optional property when present or set default value when absent
                if (data.hasOwnProperty(name) && data[name] !== null && data[name] !== undefined) {

                  sjot_validate(sjots, data[name], type[prop], sjot /**/);

                } else if (i < prop.length - 1) {

                  data[name] = sjot_default(prop.slice(i + 1), sjots, data, type[prop], sjot /**/);
                  sjot_validate(sjots, data[name], type[prop], sjot /**/);
                } else {

                  delete data[name];

                }

                if (isfinal)
                  props[name] = null;

              }

            }

          }

          if (isfinal)
            for (var prop in data)
              if (data.hasOwnProperty(prop) && !props.hasOwnProperty(prop))
                throw "Extra property " + datapath + "/" + prop + " in final object " /**/;

        } else {

          sjot_error("value", data, type /**/);

        }

      }

      return;

    case "boolean":

      // validate a boolean value
      if (type === "boolean" || type === "atom")
        return;
      if ((data && type === "true") || (!data && type === "false"))
        return;
      sjot_error("value", data, type /**/);

    case "number":

      // validate a number
      if (type === "number" || type === "float" || type === "double" || type === "atom")
        return;
      if (typeof type !== "string")
        sjot_error("value", data, type /**/);

      switch (type) {

        case "integer":

          if (!Number.isInteger(data))
            sjot_error("value", data, type /**/);
          return;

        case "byte":

          if (data < -128 || data > 127 || !Number.isInteger(data))
            sjot_error("value", data, type /**/);
          return;

        case "short":

          if (data < -32768 || data > 32767 || !Number.isInteger(data))
            sjot_error("value", data, type /**/);
          return;

        case "int":

          if (data < -2147483648 || data > 2147483647 || !Number.isInteger(data))
            sjot_error("value", data, type /**/);
          return;

        case "long":

          if (data < -140737488355328 || data > 140737488355327 || !Number.isInteger(data))
            sjot_error("value", data, type /**/);
          return;

        case "ubyte":

          if (data < 0 || data > 255 || !Number.isInteger(data))
            sjot_error("value", data, type /**/);
          return;

        case "ushort":

          if (data < 0 || data > 65535 || !Number.isInteger(data))
            sjot_error("value", data, type /**/);
          return;

        case "uint":

          if (data < 0 || data > 4294967295 || !Number.isInteger(data))
            sjot_error("value", data, type /**/);
          return;

        case "ulong":

          if (data < 0 || data > 18446744073709551615 || !Number.isInteger(data))
            sjot_error("value", data, type /**/);
          return;

        default:

          // check numeric ranges n..m,n..,..m,<n..m>,<n..,..m>,n
          // may not reject non-integers in e.g. "1.0" or non-floats in e.g. "1" because JS numbers are floats
          // TODO perhaps use a regex instead of (or with) a loop to improve performance
          for (var i = 0; i < type.length; i++) {

            var isfloat = !Number.isInteger(data);
            var exclusive = false;

            if (type.charCodeAt(i) === 0x3C) {

              exclusive = true;
              i++;

            }

            var j = type.indexOf("..", i);
            var k = type.indexOf(",", i);

            if (k === -1)
              k = type.length;

            if (i === j) {

              // check if ..m is integer, error if data is not integer
              if (isfloat) {

                var p = type.indexOf(".", j + 2);

                if (p === -1 || p >= k)
                  break;

              }

              if (type.charCodeAt(k - 1) === 0x3E) {

                // check ..m>
                if (data < Number.parseFloat(type.slice(j + 2, k - 1)))
                  return;

              } else {

                // check ..m
                if (data <= Number.parseFloat(type.slice(j + 2, k)))
                  return;

              }

            } else if (j < k && j !== -1) {

              // check if n.. is integer, error if data is not integer
              if (isfloat) {

                var p = type.indexOf(".", i);

                if (p === -1 || p >= j)
                  break;

              }

              if (j + 2 === k) {

                // check n.. and <n..
                var n = Number.parseFloat(type.slice(i, j));

                if (data > n || (!exclusive && data === n))
                  return;

              } else {

                // check if ..m is integer, error if data is not integer
                if (isfloat) {

                  var p = type.indexOf(".", j + 2);

                  if (p === -1 || p >= k)
                    break;

                }

                var n = Number.parseFloat(type.slice(i, j));

                if (type.charCodeAt(k - 1) === 0x3E) {

                  // check n..m> and <n..m>
                  if ((data > n || (!exclusive && data === n)) && data < Number.parseFloat(type.slice(j + 2, k - 1)))
                    return;

                } else {

                  // check n..m and <n..m
                  if ((data > n || (!exclusive && data === n)) && data <= Number.parseFloat(type.slice(j + 2, k)))
                    return;

                }

              }

            } else {

              // check if n is integer, error if data is not integer
              if (isfloat) {

                var p = type.indexOf(".", i);

                if (p === -1 || p >= k)
                  break;

              }

              // check n
              if (data === Number.parseFloat(type.slice(i, k)))
                return;

            }

            i = k;

          }

      }

      sjot_error("value", data, type /**/);

    case "string":

      // validate a string
      if (type === "string" || type === "char[]" || type === "atom")
        return;
      if (typeof type !== "string")
        sjot_error("value", data, type /**/);

      if (type.startsWith("(")) {

        // check regex
        if (RegExp("^" + type + "$").test(data))
          return;

      } else if (type.startsWith("char")) {

        if (type === "char") {

          if (data.length === 1)
            return;

        } else {

          return sjot_validate_bounds(data.length, type, 5 /**/);

        }

      } else {

        switch (type) {

          case "base64":

            // check base64
            if (/^[0-9A-Za-z+\/]*=?=?$/.test(data))
              return;
            break;

          case "hex":

            // check hex
            if (/^[0-9A-Fa-f]*$/.test(data))
              return;
            break;

          case "date":

            // check RFC3999 date part
            if (/^\d{4}-\d{2}-\d{2}$/.test(data))
              return;
            break;

          case "time":

            // check RFC3999 time part
            if (/^\d{2}:\d{2}:\d{2}(\.\d{1,6})?([+-]\d{2}:\d{2})?$/.test(data))
              return;
            break;

          case "datetime":

            // check RFC3999 datetime
            if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?([+-]\d{2}:\d{2})?$/.test(data))
              return;
            break;

          case "duration":

            // check ISO 8601 duration
            if (/^-?P(-?[0-9,.]*Y)?(-?[0-9,.]*M)?(-?[0-9,.]*W)?(-?[0-9,.]*D)?(T(-?[0-9,.]*H)?(-?[0-9,.]*M)?(-?[0-9,.]*S)?)?$/.test(data))
              return;
            break;

        }

      }

      sjot_error("value", data, type /**/);

    default:

      throw "SJOT schema format error in " /**/ + type;

  }

}

// check array/set/string bounds
function sjot_validate_bounds(len, type, i /**/) {

  var j = type.indexOf("]", i);
  var k = type.indexOf(",", i);

  // return if no bounds or [] or {}
  if (j === -1)
    j = type.indexOf("}", i);
  if (j === -1 || i === j)
    return;

  if (k === -1)
  {
    // check [n]
    var n = Number.parseInt(type.slice(i, j));

    if (len !== n)
      sjot_error("length", len, type /**/);

  } else if (k + 1 === j) {

    // check [n,]
    var n = Number.parseInt(type.slice(i, k));

    if (len < n)
      sjot_error("length", len, type /**/);

  } else if (i === k) {

    // check [,m]
    var m = Number.parseInt(type.slice(k + 1, j));

    if (len > m)
      sjot_error("length", len, type /**/);

  } else {

    // check [n,m]
    var n = Number.parseInt(type.slice(i, k));
    var m = Number.parseInt(type.slice(k + 1, j));

    if (len < n || len > m)
      sjot_error("length", len, type /**/);

  }

}

// extends object types by recursively expanding base object types
function sjot_extends(sjots, type, sjot /**/) {

  // put @extends base properties into this object type
  if (type.hasOwnProperty('@extends')) {

    var basetype = type['@extends'];

    // mark visited/expanded
    type['@extends'] = undefined;

    if (basetype === undefined)
      return;

    if (typeof basetype !== "string")
      throw "SJOT schema format error: " /**/ + "/@extends is not an object";

    // get referenced URI#name base type
    var base = sjot_reftype(sjots, basetype, sjot /**/);

    if (typeof base !== "object")
      throw "SJOT schema format error: " /**/ + "/@extends is not an object";

    // recursively expand
    sjot_extends(sjots, base, sjot /**/);

    for (var prop in base) {

      if (base.hasOwnProperty(prop)) {

        if (prop.startsWith("@")) {

          switch (prop) {

            case "@final":

              if (base[prop])
                throw "SJOT schema format error: " /**/ + " @extends " + basetype + " that is final";
              break;

            case "@one":
            case "@any":
            case "@all":

              if (type.hasOwnProperty(prop))
                type[prop] = type[prop].concat(base[prop]);
              else
                type[prop] = base[prop];
              break;

            case "@dep":

              if (!type.hasOwnProperty("@dep"))
                type[prop] = {};

              for (var name in base[prop]) {

                if (base[prop].hasOwnProperty(name)) {

                  if (type[prop].hasOwnProperty(name)) {

                    if (typeof type[prop][name] === "string")
                      type[prop][name] = [type[prop][name]];
                    if (typeof base[prop][name] === "string")
                      type[prop][name] = type[prop][name].concat([base[prop][name]]);
                    else
                      type[prop][name] = type[prop][name].concat(base[prop][name]);

                  } else {

                    type[prop][name] = base[prop][name];

                  }

                }

              }

              break;

          }

        } else {

          if (type.hasOwnProperty(prop))
            throw "SJOT schema format error: " /**/ + "/" + prop + " overriding of " + basetype + "/" + prop + " is not permitted";

          type[prop] = base[prop];

        }

      }

    }

  }

}

// get schema root type
function sjot_roottype(sjot) {

  if (sjot.hasOwnProperty('@root'))
    return sjot['@root'];
  for (var prop in sjot)
    if (sjot.hasOwnProperty(prop) && !prop.startsWith("@"))
      return sjot[prop];

  throw "SJOT schema has no root type";

}

// get object from type reference
function sjot_reftype(sjots, type, sjot /**/) {

  var h = type.indexOf("#");
  var prop = type.slice(h + 1);

  if (h <= 0) {

    // local reference #type to non-id schema (permit just "type")
    if (!sjot.hasOwnProperty(prop))
      throw "SJOT schema has no type " + prop + " referenced by " /**/ + "/" + type;
    type = sjot[prop];
    if (typeof type === "string" && type.indexOf("#") !== -1 && !type.startsWith("(") && !(type.endsWith("]") || type.endsWith("}")))
      throw "SJOT schema format error: " /**/ + type + " spaghetti type references not permitted";
    return type;

  } else {

    // reference URI#type
    for (var sjoot of sjots) {

      if (sjoot.hasOwnProperty('@id') && type.startsWith(sjoot['@id']) && sjoot['@id'].length === h) {

        if (!sjoot.hasOwnProperty(prop))
          throw "SJOT schema " + sjoot['@id'] + " has no type " + prop + " referenced by " /**/ + type;
        type = sjoot[prop];
        if (typeof type === "string" && type.indexOf("#") !== -1 && !type.startsWith("(") && !(type.endsWith("]") || type.endsWith("}")))
          throw "SJOT schema format error: " /**/ + type + " spaghetti type references not permitted";
        return type;

      }

    }

    // TODO get external URI type reference when URI is a URL, load async and put in sjots array

  }

}

function sjot_default(value, sjots, data, type, sjot /**/) {

  if (typeof type !== "string" || type.endsWith("]") || type.endsWith("}"))
    return null;
  if (type.indexOf("#") !== -1 && !type.startsWith("("))
    type = sjot_reftype(sjots, type, sjot /**/);
  if (typeof type !== "string" || type.endsWith("]") || type.endsWith("}"))
    return null;

  switch (type) {

    case "null":

      return null;

    case "boolean":
    case "true":
    case "false":

      return (value === "true");

    case "number":
    case "float":
    case "double":
    case "integer":
    case "byte":
    case "short":
    case "int":
    case "long":
    case "ubyte":
    case "ushort":
    case "uint":
    case "ulong":

      if (value === "null")
        return 0;
      else
        return Number.parseFloat(value);

    case "object":
    case "array":

      return null;

    default:

      // check type for numeric range and if so set number, not string
      if (!type.startsWith("(") && /\d/.test(type)) {

        if (value === "null")
          return 0;
        else
          return Number.parseFloat(value);

      }

      if (value === "null")
        return "";
      return value;

  }

}

// throw descriptive error message
function sjot_error(what, data, type /**/) {

  var a = "a";

  if (Array.isArray(type))
    a = type.length === 1 && Array.isArray(type[0]) ? "one of" : "a tuple of";
  else if (typeof type === "string")
    a = type.endsWith("]") ? "an array" : type.endsWith("}") ? "a set" : "of type"

  var b = /**/ "";

  if (typeof data === "string")
    throw /**/ " " + what + " \"" + data + "\" is not " + a + " " + type + b;
  else if (typeof data === "number" || typeof data === "boolean" || data === null)
    throw /**/ " " + what + " " + data + " is not " + a + " " + type + b;
  else
    throw /**/ " " + what + " is not " + a + " " + type + b;

}


