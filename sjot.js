/*!
 * sjot.js v0.1.3
 * by Robert van Engelen, engelen@genivia.com
 *
 * SJOT: Schemas for JSON Objects
 *
 * More info:
 * http://genivia.com/sjot.html
 *
 * Released under the BSD3 license.
 * Copyright (C) 2016, Robert van Engelen, Genivia Inc., All Rights Reserved.
 */

/* 
 * Usage:
 *
 * var obj = JSON.parse(text);
 *
 * if (SJOT.validate(obj))
 *   ... // obj validated against the embedded @sjot schema (if any)
 *
 * var schema = '{ "sometype": { ... } }';
 *
 * if (SJOT.validate(obj, "#sometype", schema))
 *   ... // obj validated against schema type sometype
 *
 * if (SJOT.validate(obj, "http://example.com/sjot.json#sometype"))
 *   ... // obj validated against schema type sometype from http://example.com/sjot.json
 *
 * // check if schema is compliant and correct (throws an exception otherwise):
 * SJOT.check(schema);
 *
 */

class SJOT {

  // validate(obj [, type [, schema ] ])
  static validate(obj, type, schema) {

    var sjots = schema;

    if (typeof schema === "string")
      sjots = JSON.parse(schema);

    if (type === undefined)
      type = "any";

    try {

      if (Array.isArray(sjots))
        sjot_validate(sjots, obj, type, sjots[0]);
      else
        sjot_validate([sjots], obj, type, sjots);

    } catch (e) {

      // console.log(e); // error handling
      return false;

    }

    return true;

  }

  // check(schema)
  static check(schema) {

    var sjots = schema;

    if (typeof schema === "string")
      sjots = JSON.parse(schema);

    sjot_check(sjots); // TODO implement

  }

}

// one validation function that is tail recursive
function sjot_validate(sjots, data, type, sjot) {

  if (type === "any") {

    if (data.hasOwnProperty('@sjot')) {

      // sjoot: validate this object using the embedded SJOT schema or schemas
      var sjoot = data['@sjot'];

      if (Array.isArray(sjoot))

        return sjot_validate(sjoot, data, sjoot[0].hasOwnProperty('@root') ? sjoot[0]['@root'] : sjoot[Object.keys(sjoot[0])[0]], sjoot[0]);
      else
        return sjot_validate([sjoot], data, sjoot.hasOwnProperty('@root') ? sjoot['@root'] : sjoot[Object.keys(sjoot)[0]], sjoot);

    }

    return;

  }

  if (typeof type === "string") {

    var h = type.indexOf("#");

    if (h === 0) {

      // validate non-id schema using the local type reference
      var prop = type.slice(h + 1);

      if (sjot.hasOwnProperty(prop))
        return sjot_validate(sjots, data, sjot[prop], sjot);

    } else if (h !== -1) {

      for (var sjoot of sjots) {

        if (sjoot.hasOwnProperty('@id') && type.startsWith(sjoot['@id']) && sjoot['@id'].length === h) {

          // validate with type reference if URI matches the @id of this SJOT schema
          var prop = type.slice(h + 1);

          if (!sjoot.hasOwnProperty(prop))
            break;
          return sjot_validate(sjots, data, sjoot[prop], sjoot);

        }

      }

      // TODO get external URI type reference when URI is a URL, load async and put in sjots array

      return;

    }

  }

  switch (typeof data) {

    case "object":

      if (data === null || data === undefined)
        throw "data==null";

      if (Array.isArray(data)) {

        // validate an array
        if (type === "array" || type === "any[]")
          return;

        if (Array.isArray(type)) {

          // validate a tuple
          if (data.length !== type.length)
            throw "data.length!=type.length";
          for (var i = 0; i < data.length; i++)
            sjot_validate(sjots, data[i], type[i], sjot);
          return;

        } else if (typeof type === "string") {

          if (type.endsWith("]")) {

            // validate an array
            var i = type.lastIndexOf("[");
            var itemtype = type.slice(0, i);

            sjot_validate_bounds(data.length, type, i + 1);

            for (var item of data)
              sjot_validate(sjots, item, itemtype, sjot);
            return;

          } else if (type.endsWith("}")) {

            // validate a set
            var i = type.lastIndexOf("{");
            var itemtype = type.slice(0, i);

            // TODO check uniqueness of array items, which must be primitive types

            sjot_validate_bounds(data.length, type, i + 1);

            for (var item of data)
              sjot_validate(sjots, item, itemtype, sjot);
            return;

          }

        }

        throw "array!=" + type;

      } else {

        // validate an object
        if (type === "object") {

          // validate this object using the embedded @sjot, if present
          return sjot_validate(sjots, data, "any", sjot);

        }

        if (type === "date" || type === "time" || type === "datetime") {

          // special case for JS (not JSON), check for Date object
          if (!data.constructor.name != "Date")
            throw "data!=Date";
          return;

        } else if (typeof type === "object") {

          // put @extends properties into this type
          while (type.hasOwnProperty("@extends")) {

            var basetype = type["@extends"];

            type["@extends"] = undefined;

            if (typeof basetype !== "string")
              break;

            var base = sjot_reftype(sjots, basetype, sjot);

            if (typeof base === "object") {

              for (var prop in base) {

                if (base.hasOwnProperty(prop)) {

                  if (prop.startsWith("@")) {

                    switch (prop) {

                      case "@extends":
                        type[prop] = base[prop];
                        break;

                      case "@final":
                        throw basetype + " is final";

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
                      throw basetype + "." + prop + " overriding";

                    type[prop] = base[prop];

                  }

                }

              }

            }

          }

          // check object properties and property types
          for (var prop in type) {

            if (prop.startsWith("@")) {

              switch (prop) {

                case "@final":

                  if (type[prop]) {

                    // TODO check if no extra properties in data

                  }

                  break;

                case "@one":

                  for (var propset of type[prop]) {

                    if (propset.reduce( function (sum, prop) { return sum + data.hasOwnProperty(prop); }, 0) !== 1)
                      throw "not one";

                  }

                  break;

                case "@any":

                  for (var propset of type[prop]) {

                    if (!propset.some(function (prop) { return data.hasOwnProperty(prop); }))
                      throw "not any";

                  }

                  break;

                case "@all":

                  for (var propset of type[prop]) {

                    if (propset.some(function (prop) { return data.hasOwnProperty(prop); }) &&
                        !propset.every(function (prop) { return data.hasOwnProperty(prop); }))
                      throw "not all or none at all";

                  }

                  break;

              }

            } else {

              var i = -1;
              
              // search for ? in property name while ignoring \\?
              do {

                i = prop.indexOf("?", i + 1);

              } while (i > 0 && prop.charCodeAt(i - 1) === 0x5C);

              if (i === -1) {

                // validate required property
                if (!data.hasOwnProperty(prop))
                  throw prop + " required";
                sjot_validate(sjots, data[prop], type[prop], sjot);

              } else {

                var name = prop.slice(0, i);

                // validate optional property when present or set default value when absent
                if (data.hasOwnProperty(name)) {

                  sjot_validate(sjots, data[name], type[prop], sjot);

                } else if (i < prop.length - 1) {

                  var value = prop.slice(i + 1);
                  var proptype = type[prop];

                  if (typeof proptype === "string") {

                    if (proptype.indexOf("#") !== -1)
                      proptype = sjot_reftype(sjots, proptype, sjot);

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
                    sjot_validate(sjots, value, proptype, sjot);
                    data[name] = value;

                  } else {

                    throw "SJOT format error in " + type;

                  }

                }

              }

            }

          }

        } else {

          throw "object!=" + type;

        }

      }

      return;

    case "boolean":

      // validate a boolean value
      if (type === "boolean" || type === "atom")
        return;
      throw "boolean!=" + type;

    case "number":

      // validate a number
      if (type === "number" || type === "float" || type === "double" || type === "atom")
        return;
      if (typeof type !== "string")
        throw type;

      switch (type) {

        case "integer":

          if (!Number.isInteger(data))
            throw data + "!=" + type;
          return;

        case "byte":

          if (data < -128 || data > 127 || !Number.isInteger(data))
            throw data + "!=" + type;
          return;

        case "short":

          if (data < -32768 || data > 32767 || !Number.isInteger(data))
            throw data + "!=" + type;
          return;

        case "int":

          if (data < -2147483648 || data > 2147483647 || !Number.isInteger(data))
            throw data + "!=" + type;
          return;

        case "long":

          if (data < -140737488355328 || data > 140737488355327 || !Number.isInteger(data))
            throw data + "!=" + type;
          return;

        case "ubyte":

          if (data < 0 || data > 255 || !Number.isInteger(data))
            throw data + "!=" + type;
          return;

        case "ushort":

          if (data < 0 || data > 65535 || !Number.isInteger(data))
            throw data + "!=" + type;
          return;

        case "uint":

          if (data < 0 || data > 4294967295 || !Number.isInteger(data))
            throw data + "!=" + type;
          return;

        case "ulong":

          if (data < 0 || data > 18446744073709551615 || !Number.isInteger(data))
            throw data + "!=" + type;
          return;

        default:

          // check numeric ranges n..m,n..,..m,<n..m>,<n..,..m>,n
          var isinteger = Number.isInteger(data);

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
                var m = Number.parseFloat(type.slice(i, k - 1));

                if (isNaN(m) || Number.isInteger(m) != isinteger)
                  throw data + "!=integer";
                if (data < m)
                  return;

              } else {

                // check ..m
                var m = Number.parseFloat(type.slice(i, k));

                if (isNaN(m) || Number.isInteger(m) != isinteger)
                  throw data + "!=integer";
                if (data <= m)
                  return;

              }

            } else if (j < k) {

              if (j + 2 == k) {

                // check n.. and <n..
                var n = Number.parseFloat(type.slice(i, j));

                if (isNaN(n) || Number.isInteger(n) != isinteger)
                  throw data + "!=integer";
                if (data > n || (!exclusive && data == n))
                  return;

              } else {

                var n = Number.parseFloat(type.slice(i, j));
                if (isNaN(n) || Number.isInteger(n) != isinteger)
                  throw data + "!=integer";

                if (type.charCodeAt(k-1) == 0x3E) {

                  // check n..m> and <n..m>
                  var m = Number.parseFloat(type.slice(j + 2, k - 1));
                  if ((data > n || (!exclusive && data == n)) && data < m)
                    return;

                } else {

                  // check n..m and <n..m
                  var m = Number.parseFloat(type.slice(j + 2, k));
                  if ((data > n || (!exclusive && data == n)) && data <= m)
                    return;

                }

              }

            } else {

              // check n
              var n = Number.parseFloat(type.slice(i, k));

              if (isNaN(n) || Number.isInteger(n) != isinteger)
                throw data + "!=integer";
              if (data == n)
                return;

            }

            i = k;

          }

      }

      throw data + "!=" + type;

    case "string":

      // validate a string
      if (type === "string" || type === "char[]" || type === "atom")
        return;
      if (typeof type !== "string")
        throw "SJOT format error in " + type;

      if (type.startsWith("(")) {

        // check regex
        if (RegExp("^" + type + "$").test(data))
          return;

      } else if (type.startsWith("char")) {

        if (type == "char") {

          if (data.length === 1)
            return;

        } else {

          sjot_validate_bounds(data.length, type, 5);
          return;

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
                  throw "data!=base64";

              }

            }

            return;

          case "hex":

            // check hex
            if (data.length % 2)
              throw "data!=hex";

            for (var i = 0; i < data.length; i++) {

              var c = data.charCodeAt(i);

              if (c < 0x30 || (c > 0x39 && c < 0x41) || (c > 0x46 && c < 0x61) || c > 0x66)
                throw "data!=hex";

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

      throw data + "!=" + type;

    default:

      throw "SJOT format error in " + type;

  }

}

// check array/set/string bounds
function sjot_validate_bounds(len, type, i) {

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
      throw "len!=" + n;

  } else if (i + 1 == k) {

    // check [,m]
    var m = Number.parseInt(type.slice(i, k));

    if (len > m)
      throw "len>" + m;

  } else if (k + 1 == j) {

    // check [n,]
    var n = Number.parseInt(type.slice(i, k));

    if (len < n)
      throw "len<" + n;

  } else {

    // check [n,m]
    var n = Number.parseInt(type.slice(i, k));
    var m = Number.parseInt(type.slice(k + 1, j));

    if (len < n)
      throw "len<" + n;
    if (len > m)
      throw "len>" + m;

  }

}

function sjot_reftype(sjots, type, sjot) {

  var h = type.indexOf("#");
  var prop = type.slice(h + 1);

  if (h <= 0) {

    // local reference #type to non-id schema (permit just "type")
    if (sjot.hasOwnProperty(prop))
      return sjot[prop];

  } else {

    // reference URI#type
    for (var sjoot of sjots) {

      if (sjoot.hasOwnProperty('@id') && type.startsWith(sjoot['@id']) && sjoot['@id'].length === h) {

        if (sjoot.hasOwnProperty(prop))
          return sjoot[prop];
        return;

      }

    }

    // TODO get external URI type reference when URI is a URL, load async and put in sjots array

  }

}
