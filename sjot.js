/*!
 * sjot.js v1.0.1
 * by Robert van Engelen, engelen@genivia.com
 *
 * SJOT: Schemas for JSON Objects
 *
 * More info:
 * http://genivia.com/sjot.html
 *
 * Released under the BSD3 license.
 * Copyright (C) 2016, Robert van Engelen, Genivia Inc, All Rights Reserved.
 */

/* 
 *  var schema = '{ "Data": { "id": "string", "v": "number", "tags?": "string{1,}" } }';
 *
 *  var text = '{ "id": "SJOT", "v": 1.0, "tags": [ "JSON", "SJOT" ] }';
 *
 *  var obj = JSON.parse(text);
 *
 *
 *  // SJOT.valid(obj [, type [, schema ] ]) tests if the obj is valid:
 *
 *  if (SJOT.valid(obj))
 *    ... // OK: self-validated obj against its embedded @sjot schema (only if a @sjot is present in obj)
 *
 *  if (SJOT.valid(obj, "#Data", schema))
 *    ... // OK: obj validated against schema
 * 
 *  if (SJOT.valid(obj, "http://example.com/sjot.json#Data"))
 *    ... // OK: obj validated against schema type Data from http://example.com/sjot.json
 *
 *
 *  // SJOT.validate(obj [, type [, schema ] ]) throws an exception with diagnostics
 *
 *  try {
 *    SJOT.validate(obj, "#Data", schema);
 *  } catch (e) {
 *    window.alert(e); // FAIL: validation failed
 *  }
 *
 *
 *  // SJOT.check(schema) checks if schema is compliant and correct (throws an exception otherwise):
 *
 *  try {
 *    SJOT.check(schema);
 *  } catch (e) {
 *    window.alert(e); // FAIL: schema is not compliant or correct
 *  }
 */

"use strict";

class SJOT {

  // valid(obj [, type [, schema ] ])
  static valid(obj, type, schema) {

    try {

      return this.validate(obj, type, schema);

    } catch (e) {

      // console.log(e); // report error
      return false;

    }

  }

  // validate(obj [, type [, schema ] ])
  static validate(obj, type, schema) {

    var sjots = schema;
    var typepath = "";

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
      sjot_validate(sjots, obj, type, sjots[0] /*FAST[*/, "$", typepath /*FAST]*/);
    else
      sjot_validate([sjots], obj, type, sjots /*FAST[*/, "$", typepath /*FAST]*/);

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
        sjot_check(sjots, false, sjots[i], sjots[i], "[" + i + "]");

    } else {

      sjot_check([sjots], false, sjots, sjots, "");

    }
    /*LEAN]*/

  }

}

// one validation function that is tail recursive
function sjot_validate(sjots, data, type, sjot /*FAST[*/, datapath, typepath /*FAST]*/) {

  if (type === "any") {

    if (data.hasOwnProperty('@sjot')) {

      // sjoot: validate this object using the embedded SJOT schema or schemas
      var sjoot = data['@sjot'];

      if (Array.isArray(sjoot))
        return sjot_validate(sjoot, data, sjot_roottype(sjoot[0]), sjoot[0] /*FAST[*/, datapath, typepath + "{" + datapath + ".@sjot}" /*FAST]*/);
      else
        return sjot_validate([sjoot], data, sjot_roottype(sjoot), sjoot/*FAST[*/, datapath, typepath + "{" + datapath + ".@sjot}" /*FAST]*/);

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
          throw "SJOT schema has no type " + prop + " referenced by " + typepath + "/" + type;
        return sjot_validate(sjots, data, sjot[prop], sjot /*FAST[*/, datapath, typepath + "/" + type /*FAST]*/);

      } else {

        var prop = type.slice(h + 1);

        for (var sjoot of sjots) {

          if (sjoot.hasOwnProperty('@id') && type.startsWith(sjoot['@id']) && sjoot['@id'].length === h) {

            // validate with type reference if URI matches the @id of this SJOT schema
            if (!sjoot.hasOwnProperty(prop))
              throw "SJOT schema " + sjoot['@id'] + " has no type " + prop + " referenced by " + typepath + "/" + type;
            return sjot_validate(sjots, data, sjoot[prop], sjoot /*FAST[*/, datapath, typepath + "/" + type /*FAST]*/);

          }

        }

        // TODO get external URI type reference when URI is a URL, load async and put in sjots array
        throw "No " + prop + " referenced by " + typepath + "/" + type;

        return;

      }

    }

  }

  // check unions (can be very expensive to validate because of trial-and-error)
  if (Array.isArray(type) && type.length === 1 && Array.isArray(type[0])) {

    // validate data against type union [[ type, type, ... ]]
    for (var itemtype of type[0]) {

      // check if itemtype is primitive
      if (typeof itemtype === "string") {

        if (itemtype.indexOf("#") !== -1 && !itemtype.startsWith("(") && !(itemtype.endsWith("]") || itemtype.endsWith("}"))) {

          itemtype = sjot_reftype(sjots, itemtype, sjot, typepath);
          if (typeof itemtype !== "string")
            sjot_error("value", data, itemtype /*FAST[*/, datapath, typepath /*FAST]*/);

        }

        try {

          return sjot_validate(sjots, data, itemtype, sjot /*FAST[*/, datapath, typepath + "/" + itemtype /*FAST]*/);

        } catch (e) { }

      }

    }

    sjot_error("value", data, type /*FAST[*/, datapath, typepath /*FAST]*/);

  }

  switch (typeof data) {

    case "object":

      if (data === null || data === undefined) {

        throw /*FAST[*/ datapath + /*FAST]*/ " is " + data;

      } else if (Array.isArray(data)) {

        // validate an array
        if (type === "array" || type === "any[]")
          return;

        if (Array.isArray(type)) {

          // validate a tuple
          if (data.length !== type.length)
            throw /*FAST[*/ datapath + /*FAST]*/ ".length=" + data.length + " is not " + /*FAST[*/ typepath + /*FAST]*/ ".length=" + type.length;
          for (var i = 0; i < data.length; i++)
            sjot_validate(sjots, data[i], type[i], sjot /*FAST[*/, datapath + "[" + i + "]", typepath + "[" + i + "]" /*FAST]*/);
          return;

        } else if (typeof type === "string") {

          if (type.endsWith("]")) {

            // validate an array
            var i = type.lastIndexOf("[");
            var itemtype = type.slice(0, i);

            sjot_validate_bounds(data.length, type, i + 1 /*FAST[*/, datapath, typepath /*FAST]*/);

            for (var j = 0; j < data.length; j++)
              sjot_validate(sjots, data[j], itemtype, sjot /*FAST[*/, datapath + "[" + j + "]", typepath /*FAST]*/);
            return;

          } else if (type.endsWith("}")) {

            // validate a set
            var i = type.lastIndexOf("{");
            var itemtype = type.slice(0, i);

            if (itemtype.indexOf("#") !== -1 && !itemtype.startsWith("(") && !(itemtype.endsWith("]") || itemtype.endsWith("}"))) {

              // get referenced URI#name type
              itemtype = sjot_reftype(sjots, itemtype, sjot, typepath);
              if (typeof itemtype !== "string")
                sjot_error("value", data, type /*FAST[*/, datapath, typepath /*FAST]*/);

            }

            // check uniqueness of items in the set
            var len = data.length;

            data = data.sort().filter(function (e, i, a) { return i === 0 || e !== a[i-1]; });
            if (data.length !== len)
              sjot_error("value", data, type /*FAST[*/, datapath, typepath /*FAST]*/);

            sjot_validate_bounds(data.length, type, i + 1 /*FAST[*/, datapath, typepath /*FAST]*/);

            for (var j = 0; j < data.length; j++)
              sjot_validate(sjots, data[j], itemtype, sjot /*FAST[*/, datapath + "[" + j + "]", typepath /*FAST]*/);
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
            sjot_extends(sjots, type, sjot, typepath);

          var isfinal = type.hasOwnProperty('@final') && type['@final'];
          var props = new Object;

          // check object properties and property types
          for (var prop in type) {

            if (prop.startsWith("@")) {

              switch (prop) {

                case "@one":

                  for (var propset of type[prop]) {

                    if (propset.reduce( function (sum, prop) { return sum + data.hasOwnProperty(prop); }, 0) !== 1)
                      throw datapath + " requires one of " + propset;

                  }

                  break;

                case "@any":

                  for (var propset of type[prop]) {

                    if (!propset.some(function (prop) { return data.hasOwnProperty(prop); }))
                      throw datapath + " requires any of" + propset;

                  }

                  break;

                case "@all":

                  for (var propset of type[prop]) {

                    if (propset.some(function (prop) { return data.hasOwnProperty(prop); }) &&
                        !propset.every(function (prop) { return data.hasOwnProperty(prop); }))
                      throw datapath + " requires all or none of " + propset;

                  }

                  break;

              }

            } else {

              var i = prop.indexOf("?");
              
              // search for ? in property name while ignoring \\?
              while (i > 0 && prop.charCodeAt(i - 1) === 0x5C)
                i = prop.indexOf("?", i + 1);

              if (i === -1) {

                // validate required property
                if (!data.hasOwnProperty(prop))
                  throw datapath + "." + prop + " is required by " + typepath + "." + prop;
                sjot_validate(sjots, data[prop], type[prop], sjot /*FAST[*/, datapath + "." + prop, typepath + "." + prop /*FAST]*/);
                if (isfinal)
                  props[prop] = null;

              } else {

                var name = prop.slice(0, i);

                // validate optional property when present or set default value when absent
                if (data.hasOwnProperty(name)) {

                  sjot_validate(sjots, data[name], type[prop], sjot /*FAST[*/, datapath + "." + name, typepath + "." + prop /*FAST]*/);

                } else if (i < prop.length - 1) {

                  var value = prop.slice(i + 1);
                  var proptype = type[prop];

                  if (typeof proptype === "string") {

                    if (proptype.indexOf("#") !== -1 && !proptype.startsWith("(") && !(proptype.endsWith("]") || proptype.endsWith("}"))) {

                      // get referenced URI#name type
                      proptype = sjot_reftype(sjots, proptype, sjot, typepath);
                      if (typeof proptype !== "string")
                        sjot_error("value", data, proptype /*FAST[*/, datapath + "." + name, typepath + "." + prop /*FAST]*/);

                    }

                    switch (proptype) {

                      case "boolean":

                        value = (value === "true");
                        break;

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

                        value = Number.parseFloat(value);
                        break;

                      default:

                        // check proptype for numeric range and if so set number, not string
                        if (!proptype.startsWith("(")) {

                          for (var i = 0; i < proptype.length; i++) {

                            if (proptype.charCodeAt(i) >= 0x30 && proptype.charCodeAt(i) <= 0x39) {

                              value = Number.parseFloat(value);
                              break;

                            }

                          }

                        }

                    }

                    // validate before assigning the default value
                    sjot_validate(sjots, value, proptype, sjot /*FAST[*/, datapath + "." + name, typepath + "." + prop /*FAST]*/);
                    data[name] = value;

                  } else {

                    throw "SJOT schema format error in " + typepath + "/" + type;

                  }

                }

                if (isfinal)
                  props[name] = null;

              }

            }

          }

          if (isfinal)
            for (var prop in data)
              if (data.hasOwnProperty(prop) && !props.hasOwnProperty(prop))
                throw "Extra property " + datapath + "." + prop + " in final object " + typepath;

        } else {

          sjot_error("value", data, type /*FAST[*/, datapath, typepath /*FAST]*/);

        }

      }

      return;

    case "boolean":

      // validate a boolean value
      if (type === "boolean" || type === "atom")
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
          for (var i = 0; i < type.length; i++) {

            var exclusive = false;

            if (type.charCodeAt(i) == 0x3C) {

              exclusive = true;
              i++;

            }

            var j = type.indexOf("..", i);
            var k = type.indexOf(",", i);

            if (k == -1)
              k = type.length;

            if (i == j) {

              if (type.charCodeAt(k-1) == 0x3E) {

                // check ..m>
                if (data < Number.parseFloat(type.slice(i, k - 1)))
                  return;

              } else {

                // check ..m
                if (data <= Number.parseFloat(type.slice(i, k)))
                  return;

              }

            } else if (j < k) {

              if (j + 2 == k) {

                // check n.. and <n..
                var n = Number.parseFloat(type.slice(i, j));

                if (data > n || (!exclusive && data == n))
                  return;

              } else {

                var n = Number.parseFloat(type.slice(i, j));

                if (type.charCodeAt(k-1) == 0x3E) {

                  // check n..m> and <n..m>
                  if ((data > n || (!exclusive && data == n)) && data < Number.parseFloat(type.slice(j + 2, k - 1)))
                    return;

                } else {

                  // check n..m and <n..m
                  if ((data > n || (!exclusive && data == n)) && data <= Number.parseFloat(type.slice(j + 2, k)))
                    return;

                }

              }

            } else {

              // check n
              if (data == Number.parseFloat(type.slice(i, k)))
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

        if (type == "char") {

          if (data.length === 1)
            return;

        } else {

          return sjot_validate_bounds(data.length, type, 5 /*FAST[*/, datapath, typepath /*FAST]*/);

        }

      } else {

        switch (type) {

          case "base64":

            // check base64
            for (var i = 0; i < data.length; i++) {

              var c = data.charCodeAt(i);

              if (c < 0x2B || (c > 0x2B && c < 0x2F) || (c > 0x39 && c < 0x41) || (c > 0x5A && c < 0x61) || c > 0x7A) {

                while (c === 0x3D && ++i < data.length)
                  c = data.charCodeAt(i);

                if (i < data.length)
                  sjot_error("value", data, type /*FAST[*/, datapath, typepath /*FAST]*/);

              }

            }

            return;

          case "hex":

            // check hex
            if (data.length % 2)
              sjot_error("value", data, type /*FAST[*/, datapath, typepath /*FAST]*/);

            for (var i = 0; i < data.length; i++) {

              var c = data.charCodeAt(i);

              if (c < 0x30 || (c > 0x39 && c < 0x41) || (c > 0x46 && c < 0x61) || c > 0x66)
                sjot_error("value", data, type /*FAST[*/, datapath, typepath /*FAST]*/);

            }

            return;

          case "date":

            // TODO check date
            return;

          case "time":

            // TODO check time
            return;

          case "datetime":

            // TODO check datetime
            return;

          case "duration":

            // check ISO 8601 duration
            if (/^(-)?P(?:(-?[0-9,.]*)Y)?(?:(-?[0-9,.]*)M)?(?:(-?[0-9,.]*)W)?(?:(-?[0-9,.]*)D)?(?:T(?:(-?[0-9,.]*)H)?(?:(-?[0-9,.]*)M)?(?:(-?[0-9,.]*)S)?)?$/.test(data))
              return;

        }

      }

      sjot_error("value", data, type /*FAST[*/, datapath, typepath /*FAST]*/);

    default:

      throw "SJOT schema format error in " + typepath + "/" + type;

  }

}

// check array/set/string bounds
function sjot_validate_bounds(len, type, i /*FAST[*/, datapath, typepath /*FAST]*/) {

  var j = type.indexOf("]", i);
  var k = type.indexOf(",", i);

  // return if no bounds or [] or {}
  if (j == -1)
    j = type.indexOf("}", i);
  if (j == -1 || i == j)
    return;

  if (k === -1)
  {
    // check [n]
    var n = Number.parseInt(type.slice(i, j));

    if (len !== n)
      sjot_error("length", len, type /*FAST[*/, datapath, typepath /*FAST]*/);

  } else if (k + 1 == j) {

    // check [n,]
    var n = Number.parseInt(type.slice(i, k));

    if (len < n)
      sjot_error("length", len, type /*FAST[*/, datapath, typepath /*FAST]*/);

  } else if (i == k) {

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

function sjot_extends(sjots, type, sjot, typepath) {

  // put @extends base properties into this object type
  while (type.hasOwnProperty('@extends')) {

    var basetype = type['@extends'];

    type['@extends'] = undefined;

    if (basetype === undefined)
      break;

    if (typeof basetype !== "string")
      throw("SJOT schema format error: " + typepath + ".@extends is not an object");

    // get referenced URI#name base type
    var base = sjot_reftype(sjots, basetype, sjot, typepath);

    if (typeof base !== "object")
      throw("SJOT schema format error: " + typepath + ".@extends is not an object");

    for (var prop in base) {

      if (base.hasOwnProperty(prop)) {

        if (prop.startsWith("@")) {

          switch (prop) {

            case "@extends":

              type[prop] = base[prop];
              break;

            case "@final":

              if (base[prop])
                throw("SJOT schema format error: " + typepath + " extends " + basetype + " that is final");
              break;

            case "@one":
            case "@any":
            case "@all":

              if (type.hasOwnProperty(prop))
                type[prop] = type[prop].concat(base[prop]);
              else
                type[prop] = base[prop];
              break;

          }

        } else {

          if (type.hasOwnProperty(prop))
            throw("SJOT schema format error: " + typepath + "." + prop + " overriding of " + basetype + "." + prop + " is not permitted");

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
function sjot_reftype(sjots, type, sjot, typepath) {

  var h = type.indexOf("#");
  var prop = type.slice(h + 1);

  if (h <= 0) {

    // local reference #type to non-id schema (permit just "type")
    if (!sjot.hasOwnProperty(prop))
      throw "SJOT schema has no type " + prop + " referenced by " + typepath + "/" + type;
    return sjot[prop];

  } else {

    // reference URI#type
    for (var sjoot of sjots) {

      if (sjoot.hasOwnProperty('@id') && type.startsWith(sjoot['@id']) && sjoot['@id'].length === h) {

        if (!sjoot.hasOwnProperty(prop))
          throw "SJOT schema " + sjoot['@id'] + " has no type " + prop + " referenced by " + typepath + "/" + type;
        return sjoot[prop];

      }

    }

    // TODO get external URI type reference when URI is a URL, load async and put in sjots array

  }

}

// throw descriptive error message
function sjot_error(what, data, type /*FAST[*/, datapath, typepath /*FAST]*/) {

  var text = "a";
  
  if (typeof type === "string")
    text = type.endsWith("]") ? "an array" : type.endsWith("}") ? "a set" : "of type";

  if (typeof data === "string")
    throw /*FAST[*/ datapath + /*FAST]*/ " " + what + " \"" + data + "\" is not " + text + " " + type /*FAST[*/ + " required by " + typepath /*FAST]*/;
  else if (typeof data === "number" || typeof data === "boolean" || typeof data === null)
    throw /*FAST[*/ datapath + /*FAST]*/ " " + what + " " + data + " is not " + text + " " + type /*FAST[*/ + " required by " + typepath /*FAST]*/;
  else
    throw /*FAST[*/ datapath + /*FAST]*/ " " + what + " is not " + text + " " + type /*FAST[*/ + " required by " + typepath /*FAST]*/;

}

/*LEAN[*/
// check schema compliance and correctness (an optional feature, can be removed for compact SJOT libraries)
function sjot_check(sjots, prim, type, sjot, typepath) {

  switch (typeof type) {

    case "object":

      if (prim)
        throw("SJOT schema format error: " + typepath + " is not a primitive type value");

      if (type === null)
        throw("SJOT schema format error: " + typepath + " is null");

      if (Array.isArray(type)) {

        if (type.length === 1 && Array.isArray(type[0])) {

          // check union
          for (var itemtype of type[0])
            sjot_check(sjots, true, itemtype, sjot, typepath + "/" + itemtype);

        } else {

          // check tuple
          for (var i = 0; i < type.length; i++)
            sjot_check(sjots, false, type[i], sjot, typepath + "[" + i + "]");

        }

      } else {

        // put @extends base properties into this object type
        sjot_extends(sjots, type, sjot, typepath);

        for (var prop in type) {

          if (prop === "@root") {

            sjot_check(sjots, false, type[prop], sjot, typepath + ".@root");

          } else if (prop === "@final") {

            // check @final is true or false
            if (typeof type[prop] !== "boolean")
              throw("SJOT schema format error: " + typepath + ".@final is not true or false");

          } else if (prop === "@one" || prop === "@any" || prop === "@all") {

            var propsets = type[prop];

            if (!Array.isArray(propsets))
              throw("SJOT schema format error: " + typepath + "." + prop + " is not an array of property sets");

            // check if the propsets are disjoint
            var temp = new Object;

            for (var propset of propsets) {

              if (!Array.isArray(propset))
                throw("SJOT schema format error: " + typepath + "." + prop + " is not an array of property sets");

              for (var name of propset) {

                if (typeof name !== "string" || name.startsWith("@"))
                  throw("SJOT schema format error: " + typepath + "." + prop + " is not an array of property sets");
                if (temp[name] === null)
                  throw("SJOT schema format error: " + typepath + "." + prop + " propsets are not disjoint sets");
                temp[name] = null;

              }

            }

            // check if propset properties are object type properties
            for (var name in type) {

              if (type.hasOwnProperty(name) && !name.startsWith("@")) {

                var i = name.indexOf("?");

                // search for ? in property name while ignoring \\?
                while (i > 0 && name.charCodeAt(i - 1) === 0x5C)
                  i = name.indexOf("?", i + 1);

                if (i !== -1)
                  name = name.slice(0, i);
                if (temp.hasOwnProperty(name))
                  temp[name] = true;

              }

            }

            for (var name in temp)
              if (temp[name] === null)
                throw("SJOT schema format error: " + typepath + "." + prop + " propsets contains " + name + " that is not a property of this object");

          } else if (!prop.startsWith("@")) {

            var i = prop.indexOf("?");

            // search for ? in property name while ignoring \\?
            while (i > 0 && prop.charCodeAt(i - 1) === 0x5C)
              i = prop.indexOf("?", i + 1);

            // check property type (primitive=true when optional with a default value)
            sjot_check(sjots, (i !== -1 && i < prop.length - 1), type[prop], sjot, typepath + "." + prop);

          }

        }

      }

      break;

    case "string":

      if (type.indexOf("#") !== -1 && !type.startsWith("(") && !(type.endsWith("]") || type.endsWith("}"))) {

        sjot_check(sjots, prim, sjot_reftype(sjots, type, sjot, typepath), sjot, typepath + "/" + type);

      } else if (type.endsWith("]")) {

        if (prim)
          throw("SJOT schema format error: " + typepath + " is not a primitive type value");

        var i = type.lastIndexOf("[");

        sjot_check(sjots, false, type.slice(0, i), sjot, typepath);

      } else if (type.endsWith("}")) {

        if (prim)
          throw("SJOT schema format error: " + typepath + " is not a primitive type value");

        var i = type.lastIndexOf("{");

        sjot_check(sjots, true, type.slice(0, i), sjot, typepath);

      } else {

        switch (type) {

          case "any":
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
          case "object":
          case "array":
            break;

          default:

            if (type.startsWith("(")) {

              if (!type.endsWith(")"))
                throw("SJOT schema format error: " + typepath + " " + type + " is not a valid regex");

              try {

                RegExp(type);

              } catch (e) {

                throw("SJOT schema format error: " + typepath + " " + type + " is not a valid regex: " + e);

              }

            } else {

              // check numeric range
              for (var i = 0; i < type.length; i++) {

                if (type.charCodeAt(i) == 0x3C)
                  i++;

                var j = type.indexOf("..", i);
                var k = type.indexOf(",", i);

                if (k == -1)
                  k = type.length;

                if (i == j) {

                  if (type.charCodeAt(k - 1) == 0x3E) {

                    // check ..m>
                    if (isNaN(Number.parseFloat(type.slice(i, k - 1))))
                      throw("SJOT schema format error: " + typepath + " " + type + " is not a type");

                  } else {

                    // check ..m
                    if (isNaN(Number.parseFloat(type.slice(i, k))))
                      throw("SJOT schema format error: " + typepath + " " + type + " is not a type");

                  }

                } else if (j < k) {

                  if (j + 2 == k) {

                    // check n.. and <n..
                    if (isNaN(Number.parseFloat(type.slice(i, j))))
                      throw("SJOT schema format error: " + typepath + " " + type + " is not a type");

                  } else {

                    if (isNaN(Number.parseFloat(type.slice(i, j))))
                      throw("SJOT schema format error: " + typepath + " " + type + " is not a type");

                    if (type.charCodeAt(k - 1) == 0x3E) {

                      // check n..m> and <n..m>
                      if (isNaN(Number.parseFloat(type.slice(j + 2, k - 1))))
                        throw("SJOT schema format error: " + typepath + " " + type + " is not a type");

                    } else {

                      // check n..m and <n..m
                      if (isNaN(Number.parseFloat(type.slice(j + 2, k))))
                        throw("SJOT schema format error: " + typepath + " " + type + " is not a type");

                    }

                  }

                } else {

                  // check n
                  if (isNaN(Number.parseFloat(type.slice(i, k))))
                    throw("SJOT schema format error: " + typepath + " " + type + " is not a type");

                }

                i = k;

              }

            }

        }

      }

      break;

    default:

      throw("SJOT schema format error: " + typepath + " has unknown type " + type);

  }

}
/*LEAN]*/

module.exports = SJOT;
