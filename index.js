/**
 * A validator for "Schemas for JSON Objects", or simply SJOT.
 * SJOT is a more compact alternative to JSON schema.  SJOT schemas are valid
 * JSON, just like JSON schema.  SJOT schemas have the look and feel of an
 * object template and are more easy to read and understand.  SJOT aims at
 * fast JSON data validation with lightweight schemas and compact validators.
 * (This initial release is not yet fully optimized for optimal performance.)
 *
 * @module      sjot
 * @version     1.2.7
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
      sjot_validate(sjots, obj, type, sjots[0] /*FAST[*/, "#", "#" /*FAST]*/);
    else
      sjot_validate([sjots], obj, type, sjots /*FAST[*/, "#", "#" /*FAST]*/);

    return true;

  }

  // check(schema)
  static check(schema) {

    var sjots = schema;

    if (typeof schema === "string")
      sjots = JSON.parse(schema);

    /*LEAN[*/
    if (Array.isArray(sjots)) {

      for (var i = 0; i < sjots.length; i++)
        sjot_check(sjots, true, false, sjots[i], sjots[i], "[" + i + "]");

    } else {

      sjot_check([sjots], true, false, sjots, sjots, "#");

    }
    /*LEAN]*/

  }

}

// one validation function that is tail recursive
function sjot_validate(sjots, data, type, sjot /*FAST[*/, datapath, typepath /*FAST]*/) {

  if (type === "any") {

    if (typeof data === "object" && data !== null && data.hasOwnProperty('@sjot')) {

      // sjoot: validate this object using the embedded SJOT schema or schemas
      var sjoot = data['@sjot'];

      if (Array.isArray(sjoot))
        return sjot_validate(sjoot, data, sjot_roottype(sjoot[0]), sjoot[0] /*FAST[*/, datapath, typepath + "{" + datapath + "/@sjot}" /*FAST]*/);
      else
        return sjot_validate([sjoot], data, sjot_roottype(sjoot), sjoot/*FAST[*/, datapath, typepath + "{" + datapath + "/@sjot}" /*FAST]*/);

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
          throw "SJOT schema has no type " + prop + " referenced by " /*FAST[*/ + typepath + "/" /*FAST]*/ + type;
        return sjot_validate(sjots, data, sjot[prop], sjot /*FAST[*/, datapath, typepath + "/" + type /*FAST]*/);

      } else {

        var prop = type.slice(h + 1);

        for (var sjoot of sjots) {

          if (sjoot.hasOwnProperty('@id') && type.startsWith(sjoot['@id']) && sjoot['@id'].length === h) {

            // validate with type reference if URI matches the @id of this SJOT schema
            if (!sjoot.hasOwnProperty(prop))
              throw "SJOT schema " + sjoot['@id'] + " has no type " + prop + " referenced by " /*FAST[*/ + typepath + "/" /*FAST]*/ + type;
            return sjot_validate(sjots, data, sjoot[prop], sjoot /*FAST[*/, datapath, typepath + "/" + type /*FAST]*/);

          }

        }

        // TODO get external URI type reference when URI is a URL, load async and put in sjots array
        throw "No " + prop + " found that is referenced by " /*FAST[*/ + typepath + "/" /*FAST]*/ + type;

        return;

      }

    }

  }

  // check unions
  if (Array.isArray(type) && type.length === 1 && Array.isArray(type[0])) {

    // validate data against type union [[ type, type, ... ]]
    /*LEAN[*/
    var union = [];
    /*LEAN]*/

    for (var itemtype of type[0]) {

      try {

        return sjot_validate(sjots, data, itemtype, sjot /*FAST[*/, datapath, typepath + "/" + itemtype /*FAST]*/);

      } catch (e) {
      
        /*LEAN[*/
        // TODO consider alternative quick checks that are faster?
        sjot_check_union(sjots, itemtype, sjot /*FAST[*/, typepath /*FAST]*/, union);
        /*LEAN]*/

      }

    }

    sjot_error("value", data, type /*FAST[*/, datapath, typepath /*FAST]*/);

  }

  switch (typeof data) {

    case "object":

      if (data === null || data === undefined) {

        if (data === null && type === "null")
          return;
        sjot_error("value", data, type /*FAST[*/, datapath, typepath /*FAST]*/);

      } else if (Array.isArray(data)) {

        // validate an array
        if (type === "array" || type === "any[]")
          return;

        if (Array.isArray(type)) {

          // validate a tuple
          if (data.length != type.length)
            throw /*FAST[*/ datapath + /*FAST]*/ " tuple length " + data.length + " is not the required " + /*FAST[*/ typepath + /*FAST]*/ " length " + type.length;

          for (var i = 0; i < data.length; i++) {

            if (data[i] === null)
              data[i] = sjot_default("null", sjots, null, type[i], sjot /*FAST[*/, datapath + "[" + i + "]", typepath + "[" + i + "]" /*FAST]*/);
            sjot_validate(sjots, data[i], type[i], sjot /*FAST[*/, datapath + "[" + i + "]", typepath + "[" + i + "]" /*FAST]*/);
          }

          return;

        } else if (typeof type === "string") {

          if (type.endsWith("]")) {

            // validate an array
            var i = type.lastIndexOf("[");
            var itemtype = type.slice(0, i);

            sjot_validate_bounds(data.length, type, i + 1 /*FAST[*/, datapath, typepath /*FAST]*/);

            for (var j = 0; j < data.length; j++) {

              if (data[j] === null)
                data[j] = sjot_default("null", sjots, null, type[j], sjot /*FAST[*/, datapath + "[" + j + "]", typepath + "[" + j + "]" /*FAST]*/);
              sjot_validate(sjots, data[j], itemtype, sjot /*FAST[*/, datapath + "[" + j + "]", typepath /*FAST]*/);

            }

            return;

          } else if (type.endsWith("}")) {

            // validate a set
            var i = type.lastIndexOf("{");
            var itemtype = type.slice(0, i);

            if (itemtype.indexOf("#") !== -1 && !itemtype.startsWith("(") && !(itemtype.endsWith("]") || itemtype.endsWith("}"))) {

              // get referenced URI#name type
              itemtype = sjot_reftype(sjots, itemtype, sjot /*FAST[*/, typepath /*FAST]*/);
              if (typeof itemtype !== "string")
                sjot_error("value", data, type /*FAST[*/, datapath, typepath /*FAST]*/);

            }

            // check uniqueness of items in the set
            var len = data.length;

            data = data.sort().filter(function (e, i, a) { return i === 0 || e !== a[i-1]; });
            if (data.length !== len)
              sjot_error("value", data, type /*FAST[*/, datapath, typepath /*FAST]*/);

            sjot_validate_bounds(data.length, type, i + 1 /*FAST[*/, datapath, typepath /*FAST]*/);

            for (var j = 0; j < data.length; j++) {

              if (data[j] === null)
                data[j] = sjot_default("null", sjots, null, type[j], sjot /*FAST[*/, datapath + "[" + j + "]", typepath + "[" + j + "]" /*FAST]*/);
              sjot_validate(sjots, data[j], itemtype, sjot /*FAST[*/, datapath + "[" + j + "]", typepath /*FAST]*/);

            }

            return;

          }

        }

        sjot_error("value", data, type /*FAST[*/, datapath, typepath /*FAST]*/);

      } else {

        // validate an object
        if (type === "object") {

          // validate this object using the embedded @sjot, if present
          return sjot_validate(sjots, data, "any", sjot /*FAST[*/, datapath, typepath /*FAST]*/);

        }

        if (type === "date" || type === "time" || type === "datetime") {

          // special case for JS (not JSON), check for Date object
          if (!data.constructor.name != "Date")
            sjot_error("value", data, type /*FAST[*/, datapath, typepath /*FAST]*/);
          return;

        } else if (typeof type === "object") {

          // put @extends base properties into this object type
          if (type.hasOwnProperty('@extends'))
            sjot_extends(sjots, type, sjot /*FAST[*/, typepath /*FAST]*/);

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

                  sjot_validate(sjots, data[name], proptype, sjot /*FAST[*/, datapath + "/" + name, typepath + "/" + prop /*FAST]*/);
                  if (isfinal)
                    props[name] = null;

                }

              }


            } else {

              var i = prop.indexOf("?");

              if (i === -1) {

                // validate required property
                if (!data.hasOwnProperty(prop))
                  throw datapath + "/" + prop + " is required by " /*FAST[*/ + typepath + "/" /*FAST]*/ + prop;
                sjot_validate(sjots, data[prop], type[prop], sjot /*FAST[*/, datapath + "/" + prop, typepath + "/" + prop /*FAST]*/);
                if (isfinal)
                  props[prop] = null;

              } else {

                var name = prop.slice(0, i);

                // validate optional property when present or set default value when absent
                if (data.hasOwnProperty(name) && data[name] !== null && data[name] !== undefined) {

                  sjot_validate(sjots, data[name], type[prop], sjot /*FAST[*/, datapath + "/" + name, typepath + "/" + prop /*FAST]*/);

                } else if (i < prop.length - 1) {

                  data[name] = sjot_default(prop.slice(i + 1), sjots, data, type[prop], sjot /*FAST[*/, datapath + "/" + name, typepath + "/" + prop /*FAST]*/);
                  sjot_validate(sjots, data[name], type[prop], sjot /*FAST[*/, datapath + "/" + name, typepath + "/" + prop /*FAST]*/);
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
                throw "Extra property " + datapath + "/" + prop + " in final object " /*FAST[*/ + typepath /*FAST]*/;

        } else {

          sjot_error("value", data, type /*FAST[*/, datapath, typepath /*FAST]*/);

        }

      }

      return;

    case "boolean":

      // validate a boolean value
      if (type === "boolean" || type === "atom")
        return;
      if ((data && type === "true") || (!data && type === "false"))
        return;
      sjot_error("value", data, type /*FAST[*/, datapath, typepath /*FAST]*/);

    case "number":

      // validate a number
      if (type === "number" || type === "float" || type === "double" || type === "atom")
        return;
      if (typeof type !== "string")
        sjot_error("value", data, type /*FAST[*/, datapath, typepath /*FAST]*/);

      switch (type) {

        case "integer":

          if (!Number.isInteger(data))
            sjot_error("value", data, type /*FAST[*/, datapath, typepath /*FAST]*/);
          return;

        case "byte":

          if (data < -128 || data > 127 || !Number.isInteger(data))
            sjot_error("value", data, type /*FAST[*/, datapath, typepath /*FAST]*/);
          return;

        case "short":

          if (data < -32768 || data > 32767 || !Number.isInteger(data))
            sjot_error("value", data, type /*FAST[*/, datapath, typepath /*FAST]*/);
          return;

        case "int":

          if (data < -2147483648 || data > 2147483647 || !Number.isInteger(data))
            sjot_error("value", data, type /*FAST[*/, datapath, typepath /*FAST]*/);
          return;

        case "long":

          if (data < -140737488355328 || data > 140737488355327 || !Number.isInteger(data))
            sjot_error("value", data, type /*FAST[*/, datapath, typepath /*FAST]*/);
          return;

        case "ubyte":

          if (data < 0 || data > 255 || !Number.isInteger(data))
            sjot_error("value", data, type /*FAST[*/, datapath, typepath /*FAST]*/);
          return;

        case "ushort":

          if (data < 0 || data > 65535 || !Number.isInteger(data))
            sjot_error("value", data, type /*FAST[*/, datapath, typepath /*FAST]*/);
          return;

        case "uint":

          if (data < 0 || data > 4294967295 || !Number.isInteger(data))
            sjot_error("value", data, type /*FAST[*/, datapath, typepath /*FAST]*/);
          return;

        case "ulong":

          if (data < 0 || data > 18446744073709551615 || !Number.isInteger(data))
            sjot_error("value", data, type /*FAST[*/, datapath, typepath /*FAST]*/);
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

      sjot_error("value", data, type /*FAST[*/, datapath, typepath /*FAST]*/);

    case "string":

      // validate a string
      if (type === "string" || type === "char[]" || type === "atom")
        return;
      if (typeof type !== "string")
        sjot_error("value", data, type /*FAST[*/, datapath, typepath /*FAST]*/);

      if (type.startsWith("(")) {

        // check regex
        if (RegExp("^" + type + "$").test(data))
          return;

      } else if (type.startsWith("char")) {

        if (type === "char") {

          if (data.length === 1)
            return;

        } else {

          return sjot_validate_bounds(data.length, type, 5 /*FAST[*/, datapath, typepath /*FAST]*/);

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

      sjot_error("value", data, type /*FAST[*/, datapath, typepath /*FAST]*/);

    default:

      throw "SJOT schema format error in " /*FAST[*/ + typepath + "/" /*FAST]*/ + type;

  }

}

// check array/set/string bounds
function sjot_validate_bounds(len, type, i /*FAST[*/, datapath, typepath /*FAST]*/) {

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
      sjot_error("length", len, type /*FAST[*/, datapath, typepath /*FAST]*/);

  } else if (k + 1 === j) {

    // check [n,]
    var n = Number.parseInt(type.slice(i, k));

    if (len < n)
      sjot_error("length", len, type /*FAST[*/, datapath, typepath /*FAST]*/);

  } else if (i === k) {

    // check [,m]
    var m = Number.parseInt(type.slice(k + 1, j));

    if (len > m)
      sjot_error("length", len, type /*FAST[*/, datapath, typepath /*FAST]*/);

  } else {

    // check [n,m]
    var n = Number.parseInt(type.slice(i, k));
    var m = Number.parseInt(type.slice(k + 1, j));

    if (len < n || len > m)
      sjot_error("length", len, type /*FAST[*/, datapath, typepath /*FAST]*/);

  }

}

// extends object types by recursively expanding base object types
function sjot_extends(sjots, type, sjot /*FAST[*/, typepath /*FAST]*/) {

  // put @extends base properties into this object type
  if (type.hasOwnProperty('@extends')) {

    var basetype = type['@extends'];

    // mark visited/expanded
    type['@extends'] = undefined;

    if (basetype === undefined)
      return;

    if (typeof basetype !== "string")
      throw "SJOT schema format error: " /*FAST[*/ + typepath /*FAST]*/ + "/@extends is not an object";

    // get referenced URI#name base type
    var base = sjot_reftype(sjots, basetype, sjot /*FAST[*/, typepath /*FAST]*/);

    if (typeof base !== "object")
      throw "SJOT schema format error: " /*FAST[*/ + typepath /*FAST]*/ + "/@extends is not an object";

    // recursively expand
    sjot_extends(sjots, base, sjot /*FAST[*/, typepath /*FAST]*/);

    for (var prop in base) {

      if (base.hasOwnProperty(prop)) {

        if (prop.startsWith("@")) {

          switch (prop) {

            case "@final":

              if (base[prop])
                throw "SJOT schema format error: " /*FAST[*/ + typepath /*FAST]*/ + " @extends " + basetype + " that is final";
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
            throw "SJOT schema format error: " /*FAST[*/ + typepath /*FAST]*/ + "/" + prop + " overriding of " + basetype + "/" + prop + " is not permitted";

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
function sjot_reftype(sjots, type, sjot /*FAST[*/, typepath /*FAST]*/) {

  var h = type.indexOf("#");
  var prop = type.slice(h + 1);

  if (h <= 0) {

    // local reference #type to non-id schema (permit just "type")
    if (!sjot.hasOwnProperty(prop))
      throw "SJOT schema has no type " + prop + " referenced by " /*FAST[*/ + typepath /*FAST]*/ + "/" + type;
    type = sjot[prop];
    if (typeof type === "string" && type.indexOf("#") !== -1 && !type.startsWith("(") && !(type.endsWith("]") || type.endsWith("}")))
      throw "SJOT schema format error: " /*FAST[*/ + typepath + "/" /*FAST]*/ + type + " spaghetti type references not permitted";
    return type;

  } else {

    // reference URI#type
    for (var sjoot of sjots) {

      if (sjoot.hasOwnProperty('@id') && type.startsWith(sjoot['@id']) && sjoot['@id'].length === h) {

        if (!sjoot.hasOwnProperty(prop))
          throw "SJOT schema " + sjoot['@id'] + " has no type " + prop + " referenced by " /*FAST[*/ + typepath + "/" /*FAST]*/ + type;
        type = sjoot[prop];
        if (typeof type === "string" && type.indexOf("#") !== -1 && !type.startsWith("(") && !(type.endsWith("]") || type.endsWith("}")))
          throw "SJOT schema format error: " /*FAST[*/ + typepath + "/" /*FAST]*/ + type + " spaghetti type references not permitted";
        return type;

      }

    }

    // TODO get external URI type reference when URI is a URL, load async and put in sjots array

  }

}

function sjot_default(value, sjots, data, type, sjot /*FAST[*/, datapath, typepath /*FAST]*/) {

  if (typeof type !== "string" || type.endsWith("]") || type.endsWith("}"))
    return null;
  if (type.indexOf("#") !== -1 && !type.startsWith("("))
    type = sjot_reftype(sjots, type, sjot /*FAST[*/, typepath /*FAST]*/);
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
function sjot_error(what, data, type /*FAST[*/, datapath, typepath /*FAST]*/) {

  var a = "a";

  if (Array.isArray(type))
    a = type.length === 1 && Array.isArray(type[0]) ? "one of" : "a tuple of";
  else if (typeof type === "string")
    a = type.endsWith("]") ? "an array" : type.endsWith("}") ? "a set" : "of type"

  var b = /*FAST[*/ typepath !== "" ? " required by " + typepath : /*FAST]*/ "";

  if (typeof data === "string")
    throw /*FAST[*/ datapath + /*FAST]*/ " " + what + " \"" + data + "\" is not " + a + " " + type + b;
  else if (typeof data === "number" || typeof data === "boolean" || data === null)
    throw /*FAST[*/ datapath + /*FAST]*/ " " + what + " " + data + " is not " + a + " " + type + b;
  else
    throw /*FAST[*/ datapath + /*FAST]*/ " " + what + " is not " + a + " " + type + b;

}

/*LEAN[*/
// check schema compliance and correctness (an optional feature, can be removed for compact SJOT libraries)
function sjot_check(sjots, root, prim, type, sjot /*FAST[*/, typepath /*FAST]*/) {

  switch (typeof type) {

    case "object":

      if (prim)
        throw "SJOT schema format error: " /*FAST[*/ + typepath /*FAST]*/ + " is not a primitive type value";

      if (type === null || type === undefined)
        throw "SJOT schema format error: " /*FAST[*/ + typepath /*FAST]*/ + " is " + type;

      if (Array.isArray(type)) {

        if (type.length === 1 && Array.isArray(type[0])) {

          // check union
          var union = [];

          for (var itemtype of type[0]) {

            sjot_check(sjots, false, false, itemtype, sjot /*FAST[*/, typepath + "/" + itemtype /*FAST]*/);
            sjot_check_union(sjots, itemtype, sjot /*FAST[*/, typepath + "/" + itemtype /*FAST]*/, union);

          }

        } else {

          // check tuple
          for (var i = 0; i < type.length; i++)
            sjot_check(sjots, false, false, type[i], sjot, /*FAST[*/ typepath + /*FAST]*/ "[" + i + "]");

        }

      } else {

        // put @extends base properties into this object type
        sjot_extends(sjots, type, sjot /*FAST[*/, typepath /*FAST]*/);

        for (var prop in type) {

	  /* TODO perhaps this is overkill to reject @root and @id in objects */
          if (prop === "@root") {

            if (!root)
              throw "SJOT schema format error: " /*FAST[*/ + typepath /*FAST]*/ + "/" + prop + " is used in an object (rewrite as a regex)";
            sjot_check(sjots, false, false, type[prop], sjot, /*FAST[*/ typepath + /*FAST]*/ "/@root");

          } else if (prop === "@id") {

            // check @id is a string
            if (!root)
              throw "SJOT schema format error: " /*FAST[*/ + typepath /*FAST]*/ + "/" + prop + " is used in an object (rewrite as a regex)";
            if (typeof type[prop] !== "string")
              throw "SJOT schema format error: " /*FAST[*/ + typepath /*FAST]*/ + "/" + prop + " is not a string";

          } else if (prop === "@note") {

            // check @note is a string
            if (typeof type[prop] !== "string")
              throw "SJOT schema format error: " /*FAST[*/ + typepath /*FAST]*/ + "/" + prop + " is not a string";

          } else if (prop === "@extends") {

            // has undefined value (by sjot_extends)

          } else if (prop === "@final") {

            // check @final is true or false
            if (typeof type[prop] !== "boolean")
              throw "SJOT schema format error: " /*FAST[*/ + typepath /*FAST]*/ + "/@final is not true or false";

          } else if (prop === "@one" || prop === "@any" || prop === "@all" || prop === "@dep") {

            var propsets = type[prop];
            var temp = {};

            if (prop !== "@dep") {
              
              if (!Array.isArray(propsets))
                throw "SJOT schema format error: " /*FAST[*/ + typepath + "/" /*FAST]*/ + prop + " is not an array of property sets";

              // check if the propsets are disjoint
              for (var propset of propsets) {

                if (!Array.isArray(propset))
                  throw "SJOT schema format error: " /*FAST[*/ + typepath + "/" /*FAST]*/ + prop + " is not an array of property sets";

                for (var name of propset) {

                  if (typeof name !== "string" || name.startsWith("@") || name.startsWith("("))
                    throw "SJOT schema format error: " /*FAST[*/ + typepath + "/" /*FAST]*/ + prop + " is not an array of property sets";
                  if (temp[name] === false)
                    throw "SJOT schema format error: " /*FAST[*/ + typepath + "/" /*FAST]*/ + prop + " propsets are not disjoint sets";
                  temp[name] = false;

                }

              }

            } else {

              for (var name in propsets) {

                if (propsets.hasOwnProperty(name)) {

                  temp[name] = false;
                  if (typeof propsets[name] === "string")
                    temp[propsets[name]] = false;
                  else if (Array.isArray(propsets[name]))
                    propsets[name].forEach(function (prop) { temp[prop] = false; });
                  else
                    throw "SJOT schema format error: " /*FAST[*/ + typepath + "/" /*FAST]*/ + prop + " malformed dependencies";

                }

              }

            }

            // check if propset properties are object type properties
            for (var name in type) {

              if (type.hasOwnProperty(name) && !name.startsWith("@")) {

                if (name.startsWith("(")) {

                  var matcher = RegExp("^" + name + "$");
                  for (var tempname in temp)
                    if (temp.hasOwnProperty(tempname) && matcher.test(tempname))
                      temp[tempname] = true;

                } else if (name.endsWith("?")) {

                  name = name.slice(0, name.length - 1);
                  if (temp.hasOwnProperty(name))
                    temp[name] = true;

                }

              }

            }

            for (var name in temp)
              if (temp[name] === false)
                throw "SJOT schema format error: " /*FAST[*/ + typepath + "/" /*FAST]*/ + prop + " propsets contains " + name + " that is not an optional property of this object";

          } else if (prop.startsWith("(")) {

            // check if valid regex property name
            if (!prop.endsWith(")"))
              throw "SJOT schema format error: " /*FAST[*/ + typepath + "/" /*FAST]*/ + prop + " is not a valid regex";

            try {

              RegExp(prop);

            } catch (e) {

              throw "SJOT schema format error: " /*FAST[*/ + typepath + "/" /*FAST]*/ + prop + " is not a valid regex: " + e;

            }

          } else if (root && prop.endsWith("]") || prop.endsWith("}")) {

            // property names cannot end in a "]" or a "}" (users should use a regex in this case!)
            throw "SJOT schema format error: " /*FAST[*/ + typepath /*FAST]*/ + "/" + prop + " type name ends with a ] or a } (use a regex for this property name instead)";

          } else {

            var i = prop.indexOf("?");

            // check property type (primitive=true when optional with a default value)
            sjot_check(sjots, false, (i !== -1 && i < prop.length - 1), type[prop], sjot, /*FAST[*/ typepath + "/" + /*FAST]*/ prop);

          }

        }

        /*FAST[*/
        if (!sjot_check_satisfiable(
              type.hasOwnProperty("@one") ? type["@one"] : [],
              type.hasOwnProperty("@any") ? type["@any"] : [],
              type.hasOwnProperty("@all") ? type["@all"] : [],
              type.hasOwnProperty("@dep") ? type["@dep"] : {}))
          throw "SJOT schema format error: " + typepath + " has non-satisfiable constraints and rejects all data";
        /*FAST]*/

      }

      break;

    case "string":

      if (type.indexOf("#") !== -1 && !type.startsWith("(") && !(type.endsWith("]") || type.endsWith("}"))) {

        var reftype = sjot_reftype(sjots, type, sjot /*FAST[*/, typepath /*FAST]*/);

        if (prim)
          return sjot_check(sjots, false, true, reftype, sjot /*FAST[*/, typepath + "/" + type /*FAST]*/);
        return;

      } else if (type.endsWith("]")) {

        var i = type.lastIndexOf("[");

        if (i === -1)
          throw "SJOT schema format error: " /*FAST[*/ + typepath /*FAST]*/ + " missing [";

        var primtype = type.slice(0, i);

        if (prim && primtype !== "char")
          throw "SJOT schema format error: " /*FAST[*/ + typepath /*FAST]*/ + " is not a primitive type value";
        return sjot_check(sjots, false, false, type.slice(0, i), sjot /*FAST[*/, typepath /*FAST]*/);

      } else if (type.endsWith("}")) {

        if (prim)
          throw "SJOT schema format error: " /*FAST[*/ + typepath /*FAST]*/ + " is not a primitive type value";

        var i = type.lastIndexOf("{");

        if (i === -1)
          throw "SJOT schema format error: " /*FAST[*/ + typepath /*FAST]*/ + " missing {";
        return sjot_check(sjots, false, true, type.slice(0, i), sjot /*FAST[*/, typepath /*FAST]*/);

      } else {

        switch (type) {

          case "atom":
          case "boolean":
          case "byte":
          case "short":
          case "int":
          case "long":
          case "ubyte":
          case "ushort":
          case "uint":
          case "ulong":
          case "integer":
          case "float":
          case "double":
          case "number":
          case "string":
          case "hex":
          case "base64":
          case "date":
          case "time":
          case "datetime":
          case "duration":
          case "char":
          case "true":
          case "false":
          case "null":

            break;

          case "any":
          case "object":
          case "array":

            if (prim)
              throw "SJOT schema format error: " /*FAST[*/ + typepath /*FAST]*/ + " is not a primitive type value";
            break;


          default:

            if (type.startsWith("(")) {

              if (!type.endsWith(")"))
                throw "SJOT schema format error: " /*FAST[*/ + typepath /*FAST]*/ + " " + type + " is not a valid regex";

              try {

                RegExp(type);

              } catch (e) {

                throw "SJOT schema format error: " /*FAST[*/ + typepath + " " /*FAST]*/ + type + " is not a valid regex: " + e;

              }

            } else {

              // check numeric range
              // TODO perhaps use a regex in this loop to improve performance?
              for (var i = 0; i < type.length; i++) {

                var e = false;

                if (type.charCodeAt(i) === 0x3C) {

                  e = true;
                  i++;

                }

                var j = type.indexOf("..", i);
                var k = type.indexOf(",", i);

                if (k === -1)
                  k = type.length;

                if (i === j) {

                  if (type.charCodeAt(k - 1) === 0x3E) {

                    // check ..m>
                    if (isNaN(Number.parseFloat(type.slice(j + 2, k - 1))))
                      throw "SJOT schema format error: " /*FAST[*/ + typepath + " " /*FAST]*/ + type + " is not a type";

                  } else {

                    // check ..m
                    if (isNaN(Number.parseFloat(type.slice(j + 2, k))))
                      throw "SJOT schema format error: " /*FAST[*/ + typepath + " " /*FAST]*/ + type + " is not a type";

                  }

                } else if (j < k && j !== -1 ) {

                  if (j + 2 === k) {

                    // check n.. and <n..
                    if (isNaN(Number.parseFloat(type.slice(i, j))))
                      throw "SJOT schema format error: " /*FAST[*/ + typepath + " " /*FAST]*/ + type + " is not a type";

                  } else {

                    var n, m;

                    n = Number.parseFloat(type.slice(i, j));
                    if (isNaN(n))
                      throw "SJOT schema format error: " /*FAST[*/ + typepath + " " /*FAST]*/ + type + " is not a type";

                    if (type.charCodeAt(k - 1) === 0x3E) {

                      // check n..m> and <n..m>
                      e = true;
                      m = Number.parseFloat(type.slice(j + 2, k - 1));
                      if (isNaN(m))
                        throw "SJOT schema format error: " /*FAST[*/ + typepath + " " /*FAST]*/ + type + " is not a type";

                    } else {

                      // check n..m and <n..m
                      m = Number.parseFloat(type.slice(j + 2, k));
                      if (isNaN(m))
                        throw "SJOT schema format error: " /*FAST[*/ + typepath + " " /*FAST]*/ + type + " is not a type";

                    }

                    if (n > m || (e && n === m))
                      throw "SJOT schema format error: " /*FAST[*/ + typepath + " " /*FAST]*/ + type + " has empty range " + n + ".." + m;

                  }

                } else {

                  // check n
                  if (isNaN(Number.parseFloat(type.slice(i, k))))
                    throw "SJOT schema format error: " /*FAST[*/ + typepath + " " /*FAST]*/ + type + " is not a type";

                }

                i = k;

              }

            }

        }

      }

      break;

    default:

      throw "SJOT schema format error: " /*FAST[*/ + typepath /*FAST]*/ + " has unknown type " + type;

  }

}

function sjot_check_union(sjots, type, sjot /*FAST[*/, typepath /*FAST]*/, union) {

  // count array depth, each depth has its own type conflict set
  var n = 1;

  if (typeof type === "string") {

    var i = type.length;

    while (i > 0) {

      if (type.charCodeAt(i - 1) === 0x5D)
        i = type.lastIndexOf("[", i - 1);
      else if (type.charCodeAt(i - 1) === 0x7D)
        i = type.lastIndexOf("{", i - 1);
      else
        break;
      n++;

    }

    // n is array depth, now get item type and check if this is a type reference
    type = type.slice(0, i);

    if (type.indexOf("#") !== -1 && !type.startsWith("(")) {

      type = sjot_reftype(sjots, type, sjot /*FAST[*/, typepath /*FAST]*/);

      i = type.length;

      while (i > 0) {

        if (type.charCodeAt(i - 1) === 0x5D)
          i = type.lastIndexOf("[", i - 1);
        else if (type.charCodeAt(i - 1) === 0x7D)
          i = type.lastIndexOf("{", i - 1);
        else
          break;
        n++;

      }

    }


    if (type === "char" && n > 0) {

      // "char[]" is a special case
      type = "string";
      n--;

    } else if (type === "array") {

      // "array" is synonymous to "any[]"
      type = "any";
      n++;

    }

  } else if (type === "array" || Array.isArray(type)) {

    // tuple is represented by "any[]"
    type = "any";
    n++;

  }

  // union[0] is the cut-off array depth where everything is "any" and will conflict
  if (union[0] !== undefined && n >= union[0])
    throw "SJOT schema format error: " /*FAST[*/ + typepath /*FAST]*/ + " union requires distinct types";

  // record null, boolean, number, string, and object types for conflict checking at array depth n
  if (union[n] === undefined)
    union[n] = { n: false, b: false, x: false, s: false, o: false };

  if (typeof type === "string") {

    switch (type) {

      case "null":

        if (union[n].n)
          throw "SJOT schema format error: " /*FAST[*/ + typepath /*FAST]*/ + " union has multiple null types";
        union[n].n = true;
        break;

      case "boolean":
      case "true":
      case "false":

        if (n > 1 && union[n].b)
          throw "SJOT schema format error: " /*FAST[*/ + typepath /*FAST]*/ + " union has multiple boolean array types";
        union[n].b = true;
        break;

      case "byte":
      case "short":
      case "int":
      case "long":
      case "ubyte":
      case "ushort":
      case "uint":
      case "ulong":
      case "integer":
      case "float":
      case "double":
      case "number":

        if (n > 1 && union[n].x)
          throw "SJOT schema format error: " /*FAST[*/ + typepath /*FAST]*/ + " union has multiple numeric array types";
        union[n].x = true;
        break;

      case "string":
      case "hex":
      case "base64":
      case "date":
      case "time":
      case "datetime":
      case "duration":
      case "char":

        if (n > 1 && union[n].s)
          throw "SJOT schema format error: " /*FAST[*/ + typepath /*FAST]*/ + " union has multiple string array types";
        union[n].s = true;
        break;

      case "any":

        for (var i = n; i < union.length; i++)
          if (union[i] !== undefined && (union[i].n || union[i].b || union[i].x || union[i].s || union[i].o))
            throw "SJOT schema format error: " /*FAST[*/ + typepath /*FAST]*/ + " union requires distinct types";
        union[0] = n;
        break;

      case "atom":

        if (union[n].b || union[n].x || union[n].s)
          throw "SJOT schema format error: " /*FAST[*/ + typepath /*FAST]*/ + " union has multiple atomic types";
        union[n].b = true;
        union[n].x = true;
        union[n].s = true;
        break;

      case "object":

        if (union[n].o)
          throw "SJOT schema format error: " /*FAST[*/ + typepath /*FAST]*/ + " union has multiple object types";
        union[n].o = true;
        break;

      default:

        if (type.startsWith("(")) {

          if (n > 1 && union[n].s)
            throw "SJOT schema format error: " /*FAST[*/ + typepath /*FAST]*/ + " union has multiple string array types";
          union[n].s = true;

        } else {

          if (n > 1 && union[n].x)
            throw "SJOT schema format error: " /*FAST[*/ + typepath /*FAST]*/ + " union has multiple numeric array types";
          union[n].x = true;

        }

    }

  } else if (typeof type === "object") {

    if (union[n].o === true)
      throw "SJOT schema format error: " /*FAST[*/ + typepath /*FAST]*/ + " union requires distinct object types";

    var empty = false;

    if (union[n].o === false) {

      empty = true;
      union[n].o = {};

    }

    for (var prop in type) {

      if (type.hasOwnProperty(prop)) {

        if (prop.startsWith("(")) {

          // regex property means only one object permitted in the union to ensure uniqueness
          if (!empty)
            throw "SJOT schema format error: " /*FAST[*/ + typepath /*FAST]*/ + " union requires distinct object types";
          union[n].o = true;
          break;

        } else {

          var i = prop.indexOf("?");

          if (i !== -1)
            prop = prop.slice(0, i);
          if (union[n].o.hasOwnProperty(prop))
            throw "SJOT schema format error: " /*FAST[*/ + typepath /*FAST]*/ + " union requires distinct object types";
          union[n].o[prop] = true;

        }

      }

    }
    
  }

}

/*FAST[*/
// SJOT schema model checker: check if constraints are satisfiable, takes 2^n time to test n distinct variables in constraints
// returns true if the model is satisfiable
// returns false when the schema for this object rejects all data, 
// cuts off and returns true when over 20 distinct variables from @one, @any, @all, @dep are collected per object
function sjot_check_satisfiable(one, any, all, dep) {

  var bits = {};

  one.forEach(function (props) { props.forEach(function (prop) { bits[prop] = false; }); });
  any.forEach(function (props) { props.forEach(function (prop) { bits[prop] = false; }); });
  all.forEach(function (props) { props.forEach(function (prop) { bits[prop] = false; }); });

  for (var prop in dep) {

    bits[prop] = false;
    if (typeof dep[prop] === "string")
      bits[dep[prop]] = false;
    else
      dep[prop].forEach(function (prop) { bits[prop] = false; });

  }

  var keys = Object.keys(bits);
  var n = keys.length;

  if (n < 2 || n > 20)
    return true;

  var pow2 = 1 << n;

  loop: for (var k = 0; k < pow2; k++) {

    for (var i = 0; i < n; i++)
      bits[keys[i]] = (k & 1 << i) !== 0;

    for (var props of one)
      if (props.reduce(function (sum, prop) { return sum + bits[prop]; }, 0) !== 1)
        continue loop;
    for (var props of any)
      if (!props.some(function (prop) { return bits[prop]; }))
        continue loop;
    for (var props of all)
      if (props.some(function (prop) { return bits[prop]; }) && !props.every(function (prop) { return bits[prop]; }))
        continue loop;
    for (var prop in dep)
      if (dep.hasOwnProperty(prop) &&
          (typeof dep[prop] !== "string" || !bits[dep[prop]]) &&
          (typeof dep[prop] !== "object" || !bits[prop].every(function (prop) { return bits[prop]; })))
        continue loop;
    return true;

  }

  return false;

}
/*FAST]*/
/*LEAN]*/

module.exports = SJOT;
