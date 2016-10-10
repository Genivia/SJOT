/**
 * A validator for "Schemas for JSON Objects", or simply SJOT.
 * SJOT is a much simpler alternative to JSON schema.  SJOT schemas are valid
 * JSON, just like JSON schema.  But SJOT schemas have the look and feel of an
 * object template and are readable and understandable by humans.  SJOT aims at
 * quick JSON data validation with lightweight schemas and compact validators.
 *
 * @module      sjot
 * @version     {VERSION}
 * @class       SJOT
 * @author      Robert van Engelen, engelen@genivia.com
 * @copyright   Robert van Engelen, Genivia Inc, 2016. All Rights Reserved.
 * @license     BSD3
 * @link        http://sjot.org
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
      sjot_validate(sjots, obj, type, sjots[0] /*FAST[*/, "#", "" /*FAST]*/);
    else
      sjot_validate([sjots], obj, type, sjots /*FAST[*/, "#", "" /*FAST]*/);

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
        throw "No " + prop + " referenced by " /*FAST[*/ + typepath + "/" /*FAST]*/ + type;

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

          itemtype = sjot_reftype(sjots, itemtype, sjot /*FAST[*/, typepath /*FAST]*/);
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

        if (data === null && type === "null")
          return;
        sjot_error("value", data, type /*FAST[*/, datapath, typepath /*FAST]*/);

        // FIXME throw /*FAST[*/ datapath + /*FAST]*/ " is " + data;

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
            sjot_extends(sjots, type, sjot /*FAST[*/, typepath /*FAST]*/);

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
                  throw datapath + "/" + prop + " is required by " /*FAST[*/ + typepath + "/" /*FAST]*/ + prop;
                sjot_validate(sjots, data[prop], type[prop], sjot /*FAST[*/, datapath + "/" + prop, typepath + "/" + prop /*FAST]*/);
                if (isfinal)
                  props[prop] = null;

              } else {

                var name = prop.slice(0, i);

                // validate optional property when present or set default value when absent
                if (data.hasOwnProperty(name)) {

                  sjot_validate(sjots, data[name], type[prop], sjot /*FAST[*/, datapath + "/" + name, typepath + "/" + prop /*FAST]*/);

                } else if (i < prop.length - 1) {

                  var value = prop.slice(i + 1);
                  var proptype = type[prop];

                  if (typeof proptype === "string") {

                    if (proptype.indexOf("#") !== -1 && !proptype.startsWith("(") && !(proptype.endsWith("]") || proptype.endsWith("}"))) {

                      // get referenced URI#name type
                      proptype = sjot_reftype(sjots, proptype, sjot /*FAST[*/, typepath /*FAST]*/);
                      if (typeof proptype !== "string")
                        sjot_error("value", data, proptype /*FAST[*/, datapath + "/" + name, typepath + "/" + prop /*FAST]*/);

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
                    sjot_validate(sjots, value, proptype, sjot /*FAST[*/, datapath + "/" + name, typepath + "/" + prop /*FAST]*/);
                    data[name] = value;

                  } else {

                    throw "SJOT schema format error in " /*FAST[*/ + typepath + "/" /*FAST]*/ + type;

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

            // check hex (check length should be multiple of 2??)
            // if (data.length % 2)
              // sjot_error("value", data, type /*FAST[*/, datapath, typepath /*FAST]*/);

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

      throw "SJOT schema format error in " /*FAST[*/ + typepath + "/" /*FAST]*/ + type;

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

// throw descriptive error message
function sjot_error(what, data, type /*FAST[*/, datapath, typepath /*FAST]*/) {

  var a = typeof type !== "string" ? "a" : type.endsWith("]") ? "an array" : type.endsWith("}") ? "a set" : "of type";
  var b = /*FAST[*/ typepath !== "" ? " required by " + typepath : /*FAST]*/ "";

  if (typeof data === "string")
    throw /*FAST[*/ datapath + /*FAST]*/ " " + what + " \"" + data + "\" is not " + a + " " + type + b;
  else if (typeof data === "number" || typeof data === "boolean" || data === null)
    throw /*FAST[*/ datapath + /*FAST]*/ " " + what + " " + data + " is not " + a + " " + type + b;
  else
    throw /*FAST[*/ datapath + /*FAST]*/ " " + what + " is not " + a + " " + type + b;

}


