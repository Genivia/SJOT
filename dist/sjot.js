/**
 * Schemas for JSON Objects, or simply SJOT, offers faster JSON validation with
 * lightweight schemas and compact validators.  SJOT schemas have the look and
 * feel of object templates and are easy to use.
 *
 * See README.md
 *
 * @module      sjot
 * @version     1.3.14
 * @class       SJOT
 * @author      Robert van Engelen, engelen@genivia.com
 * @copyright   Robert van Engelen, Genivia Inc, 2016-2017. All Rights Reserved.
 * @license     BSD 3-Clause
 * @link        http://sjot.org
 */

"use strict";

class SJOT {

  // valid(data [, type|"[URI]#[type]"|"@root"|null [, schema ] ])
  // returns true when data is valid according to schema, false otherwise
  static valid(data, type, schema) {

    try {

      return this.validate(data, type, schema);

    } catch (e) {

      /*LOG[*/console.log(e);/*LOG]*/
      return false;

    }

  }

  // validate(data [, type|"[URI]#[type]"|"@root"|null [, schema ] ])
  // throws a string exception when data is not valid according to schema
  static validate(data, type, schema) {

    var sjots = schema;

    if (typeof schema === "string")
      sjots = JSON.parse(schema);

    // types "#" and "@root" are synonymous to null: all look for the SJOT @root
    if (type === "#" || type === "@root")
      type = null;

    if (type === undefined || type === null) {

      if (sjots === undefined || sjots === null)
        type = "any";
      else if (Array.isArray(sjots) && sjots.length > 0)
        type = sjot_roottype(sjots[0]);
      else if (typeof sjots === "object")
        type = sjot_roottype(sjots);
      else
        sjot_schema_error("is not a SJOT schema object"/*FAST[*/, typeof sjots/*FAST]*/);

    }

    if (Array.isArray(sjots) && sjots.length > 0)
      sjot_validate(sjots, data, type, sjots[0]/*FAST[*/, "$", "/@root"/*FAST]*/);
    else
      sjot_validate([sjots], data, type, sjots/*FAST[*/, "$", "/@root"/*FAST]*/);

    return true;

  }

  // check(schema)
  // throws a string exception when schema has an error
  static check(schema) {

    var sjots = schema;

    if (typeof schema === "string")
      sjots = JSON.parse(schema);

    /*LEAN[*/
    if (Array.isArray(sjots)) {

      for (var i = 0; i < sjots.length; i++)
        sjot_check(sjots, true, false, sjots[i], sjots[i], "[" + i + "]");

    } else {

      sjot_check([sjots], true, false, sjots, sjots, "");

    }
    /*LEAN]*/

  }

}

// one validation function that is tail recursive, simply returns or throws validation error
function sjot_validate(sjots, data, type, sjot/*FAST[*/, datapath, typepath/*FAST]*/) {

  if (type === "any") {

    // check if object has a @sjot attribute with an embedded SJOT schema
    if (typeof data === "object" && data !== null && data.hasOwnProperty('@sjot')) {

      // sjoot: validate this object using the embedded SJOT schema or array of schemas
      var sjoot = data['@sjot'];

      if (Array.isArray(sjoot))
        return sjot_validate(sjots.concat(sjoot), data, sjot_roottype(sjoot[0]), sjoot[0]/*FAST[*/, datapath, typepath + "{" + datapath + ".@sjot}"/*FAST]*/);
      else if (typeof sjoot === "string" && sjoot !== "any" && sjoot !== "object")
        return sjot_validate(sjots, data, sjoot, sjot/*FAST[*/, datapath, typepath + "{" + datapath + ".@sjot}"/*FAST]*/);
      else if (typeof sjoot === "object")
        return sjot_validate(sjots.concat([sjoot]), data, sjot_roottype(sjoot), sjoot/*FAST[*/, datapath, typepath + "{" + datapath + ".@sjot}"/*FAST]*/);
      throw "Invalid @sjot schema "/*FAST[*/ + datapath/*FAST]*/;

    }

    return;

  }

  if (typeof type === "string") {

    var h = type.indexOf("#");

    if (h >= 0 && !type.startsWith("(") && !type.endsWith("]") && !type.endsWith("}"))
      return sjot_validate(
          sjots,
          data,
          sjot_reftype(sjots, type, sjot/*FAST[*/, typepath/*FAST]*/),
          sjot/*FAST[*/, datapath, typepath + "/" + type/*FAST]*/);

  }

  // check unions
  if (sjot_is_union(type))
    return sjot_validate_union(sjots, data, type, sjot/*FAST[*/, datapath, typepath/*FAST]*/);

  switch (typeof data) {

    case "object":

      // catch null and undefined, null validates against the "null" type
      if (data === null || data === undefined) {

        if (data === null && type === "null")
          return;
        sjot_error("value", data, type/*FAST[*/, datapath, typepath/*FAST]*/);

      } else if (Array.isArray(data)) {

        // validate an array
        if (type === "array" || type === "any[]")
          return;

        if (Array.isArray(type)) {

          if (type.length === 0)
            return;

          if (type.length === 1) {

            // validate an array [type] or [n] (fixed size array)
            if (typeof type[0] === "number") {

              if (data.length !== type[0])
                sjot_error("length", type[0], "any"/*FAST[*/, datapath, typepath + "[" + type[0] + "]"/*FAST]*/);

            } else {

              // validate array [type] and replace nulls in array with primitive type default value
              for (var i = 0; i < data.length; i++) {

                if (data[i] === null)
                  data[i] = sjot_default("null", sjots, null, type[0], sjot/*FAST[*/, datapath + "[" + i + "]", typepath + "[" + type[0] + "]"/*FAST]*/);
                sjot_validate(sjots, data[i], type[0], sjot/*FAST[*/, datapath + "[" + i + "]", typepath + "[" + type[0] + "]"/*FAST]*/);
              }

            }

          } else if (typeof type[1] === "number") {

            // validate an array [type,m] or [n,m]
            if (data.length > type[1])
              sjot_error("length", type[1], type[0]/*FAST[*/, datapath, typepath + "[" + type[0] + "," + type[1] + "]"/*FAST]*/);

            if (typeof type[0] === "number") {

              // validate an array [n,m]
              if (data.length < type[0])
                sjot_error("length", type[0], "any"/*FAST[*/, datapath, typepath + "[" + type[0] + "," + type[1] + "]"/*FAST]*/);

            } else {

              // validate an array [type,m] and replace nulls in array with primitive type default value
              for (var i = 0; i < data.length; i++) {

                if (data[i] === null)
                  data[i] = sjot_default("null", sjots, null, type[0], sjot/*FAST[*/, datapath + "[" + i + "]", typepath + "[" + type[0] + "," + type[1] + "]"/*FAST]*/);
                sjot_validate(sjots, data[i], type[0], sjot/*FAST[*/, datapath + "[" + i + "]", typepath + "[" + type[0] + "," + type[1] + "]"/*FAST]*/);

              }

            }

          } else if (typeof type[0] === "number") {

            // validate an array [n,type] or [n,type,m]
            if (data.length < type[0])
              sjot_error("length", type[0], type[1]/*FAST[*/, datapath, typepath + "[" + type[0] + "," + type[1] + "]"/*FAST]*/);

            // validate an array [n,type,m]
            if (type.length > 2 && typeof type[2] === "number") {

              if (data.length > type[2])
                sjot_error("length", type[2], type[1]/*FAST[*/, datapath, typepath + "[" + type[0] + "," + type[1] + "," + type[2] + "]"/*FAST]*/);

            }

            // validate an array [n,type] or [n,type,m]
            for (var i = 0; i < data.length; i++) {

              if (data[i] === null)
                data[i] = sjot_default("null", sjots, null, type[1], sjot/*FAST[*/, datapath + "[" + i + "]", typepath + "[" + type[0] + "," + type[1] + "]"/*FAST]*/);
              sjot_validate(sjots, data[i], type[1], sjot/*FAST[*/, datapath + "[" + i + "]", typepath + "[" + type[0] + "," + type[1] + "]"/*FAST]*/);

            }

          } else if (type.length > 0) {

            // validate a tuple [type, type, ...] and replace nulls with primitive type default value
            if (data.length != type.length)
              sjot_error("array of length", data.length, type/*FAST[*/, datapath, typepath/*FAST]*/);

            for (var i = 0; i < data.length; i++) {

              if (data[i] === null)
                data[i] = sjot_default("null", sjots, null, type[i], sjot/*FAST[*/, datapath + "[" + i + "]", typepath + "[" + i + "]"/*FAST]*/);
              sjot_validate(sjots, data[i], type[i], sjot/*FAST[*/, datapath + "[" + i + "]", typepath + "[" + i + "]"/*FAST]*/);

            }

          }

          return;

        } else if (typeof type === "string") {

          if (type.endsWith("]")) {

            // validate an array
            var i = type.lastIndexOf("[");
            var itemtype = type.slice(0, i);

            sjot_validate_bounds(data.length, type, i + 1/*FAST[*/, datapath, typepath/*FAST]*/);

            // validate an array "type[n,m]" and replace nulls with primitive type default value
            for (var j = 0; j < data.length; j++) {

              if (data[j] === null)
                data[j] = sjot_default("null", sjots, null, itemtype, sjot/*FAST[*/, datapath + "[" + j + "]", typepath/*FAST]*/);
              sjot_validate(sjots, data[j], itemtype, sjot/*FAST[*/, datapath + "[" + j + "]", typepath/*FAST]*/);

            }

            return;

          } else if (type.endsWith("}")) {

            // validate a set (array of unique atoms)
            var i = type.lastIndexOf("{");
            var itemtype = type.slice(0, i);

            if (itemtype.indexOf("#") !== -1 && !itemtype.startsWith("(") && !itemtype.endsWith("]") && !itemtype.endsWith("}")) {

              // get referenced URI#name type
              itemtype = sjot_reftype(sjots, itemtype, sjot/*FAST[*/, typepath/*FAST]*/);
              if (typeof itemtype !== "string")
                sjot_error("value", data, type/*FAST[*/, datapath, typepath/*FAST]*/);

            }

            // check uniqueness of items in the set by sorting the array
            var len = data.length;

            data = data.sort().filter(function (e, i, a) { return i === 0 || e !== a[i - 1]; });
            if (data.length !== len)
              sjot_error("value", data, type/*FAST[*/, datapath, typepath/*FAST]*/);

            sjot_validate_bounds(data.length, type, i + 1/*FAST[*/, datapath, typepath/*FAST]*/);

            // validate a set "type{n,m}" and replace nulls with primitive type default value
            for (var j = 0; j < data.length; j++) {

              if (data[j] === null)
                data[j] = sjot_default("null", sjots, null, itemtype, sjot/*FAST[*/, datapath + "[" + j + "]", typepath/*FAST]*/);
              sjot_validate(sjots, data[j], itemtype, sjot/*FAST[*/, datapath + "[" + j + "]", typepath/*FAST]*/);

            }

            return;

          }

        }

        sjot_error("value", data, type/*FAST[*/, datapath, typepath/*FAST]*/);

      } else {

        // validate an object
        if (type === "object") {

          // validate this object using the embedded @sjot, if present
          return sjot_validate(sjots, data, "any", sjot/*FAST[*/, datapath, typepath/*FAST]*/);

        }

        if (type === "date" || type === "time" || type === "datetime") {

          // special case for JS (not JSON), check for Date object
          if (!data.constructor.name != "Date")
            sjot_error("value", data, type/*FAST[*/, datapath, typepath/*FAST]*/);
          return;

        } else if (typeof type === "object") {

          // put @extends base properties into this object type to speed up repeated validation
          if (type.hasOwnProperty('@extends'))
            sjot_extends(sjots, type, sjot/*FAST[*/, typepath/*FAST]*/);

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
                      sjot_error("requires one of " + propset + " properties", data, ""/*FAST[*/, datapath, typepath + "/@one"/*FAST]*/);
                  break;

                case "@any":

                  for (var propset of proptype)
                    if (!propset.some(function (prop) { return data.hasOwnProperty(prop); }))
                      sjot_error("requires any of " + propset + " properties", data, ""/*FAST[*/, datapath, typepath + "/@any"/*FAST]*/);
                  break;

                case "@all":

                  for (var propset of proptype)
                    if (propset.some(function (prop) { return data.hasOwnProperty(prop); }) &&
                        !propset.every(function (prop) { return data.hasOwnProperty(prop); }))
                      sjot_error("requires all or none of " + propset + " properties", data, ""/*FAST[*/, datapath, typepath + "/@all"/*FAST]*/);
                  break;

                case "@dep":

                  for (var name in proptype)
                    if (data.hasOwnProperty(name) &&
                        (typeof proptype[name] !== "string" || !data.hasOwnProperty(proptype[name])) &&
                        (!Array.isArray(proptype[name]) || !proptype[name].every(function (prop) { return data.hasOwnProperty(prop); })))
                      sjot_error("requires " + proptype[name], data, ""/*FAST[*/, datapath + "." + name, typepath + "/@dep"/*FAST]*/);
                  break;

              }

            } else if (prop.startsWith("(")) {

              // regex property name
              var proptype = type[prop];
              var matcher = RegExp("^" + prop + "$");

              for (var name in data) {

                if (data.hasOwnProperty(name) && matcher.test(name)) {

                  sjot_validate(sjots, data[name], proptype, sjot/*FAST[*/, datapath + "." + name, typepath + "/" + prop/*FAST]*/);
                  if (isfinal)
                    props[name] = null;

                }

              }


            } else {

              var i = prop.indexOf("?");

              if (i === -1) {

                // validate required property
                if (!data.hasOwnProperty(prop))
                  sjot_error("should be present", data, ""/*FAST[*/, datapath + "." + prop, typepath/*FAST]*/);
                sjot_validate(sjots, data[prop], type[prop], sjot/*FAST[*/, datapath + "." + prop, typepath + "/" + prop/*FAST]*/);
                if (isfinal)
                  props[prop] = null;

              } else {

                var name = prop.slice(0, i);

                // validate optional property when present or set default value when absent
                if (data.hasOwnProperty(name) && data[name] !== null && data[name] !== undefined) {

                  sjot_validate(sjots, data[name], type[prop], sjot/*FAST[*/, datapath + "." + name, typepath + "/" + prop/*FAST]*/);

                } else if (i < prop.length - 1) {

                  data[name] = sjot_default(prop.slice(i + 1), sjots, data, type[prop], sjot/*FAST[*/, datapath + "." + name, typepath + "/" + prop/*FAST]*/);
                  sjot_validate(sjots, data[name], type[prop], sjot/*FAST[*/, datapath + "." + name, typepath + "/" + prop/*FAST]*/);
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
                sjot_error("additional property should not be present", data, ""/*FAST[*/, datapath + "." + prop, typepath + "/@final"/*FAST]*/);

        } else {

          sjot_error("value", data, type/*FAST[*/, datapath, typepath/*FAST]*/);

        }

      }

      return;

    case "boolean":

      // validate a boolean value
      if (type === "boolean" || type === "atom" || (data && type === "true") || (!data && type === "false"))
        return;
      sjot_error("value", data, type/*FAST[*/, datapath, typepath/*FAST]*/);

    case "number":

      // validate a number
      switch (type) {

        case "atom":
        case "number":
        case "float":
        case "double":

          return;

        case "integer":

          if (!Number.isInteger(data))
            sjot_error("value", data, type/*FAST[*/, datapath, typepath/*FAST]*/);
          return;

        case "byte":

          if (data < -128 || data > 127 || !Number.isInteger(data))
            sjot_error("value", data, type/*FAST[*/, datapath, typepath/*FAST]*/);
          return;

        case "short":

          if (data < -32768 || data > 32767 || !Number.isInteger(data))
            sjot_error("value", data, type/*FAST[*/, datapath, typepath/*FAST]*/);
          return;

        case "int":

          if (data < -2147483648 || data > 2147483647 || !Number.isInteger(data))
            sjot_error("value", data, type/*FAST[*/, datapath, typepath/*FAST]*/);
          return;

        case "long":

          if (data < -140737488355328 || data > 140737488355327 || !Number.isInteger(data))
            sjot_error("value", data, type/*FAST[*/, datapath, typepath/*FAST]*/);
          return;

        case "ubyte":

          if (data < 0 || data > 255 || !Number.isInteger(data))
            sjot_error("value", data, type/*FAST[*/, datapath, typepath/*FAST]*/);
          return;

        case "ushort":

          if (data < 0 || data > 65535 || !Number.isInteger(data))
            sjot_error("value", data, type/*FAST[*/, datapath, typepath/*FAST]*/);
          return;

        case "uint":

          if (data < 0 || data > 4294967295 || !Number.isInteger(data))
            sjot_error("value", data, type/*FAST[*/, datapath, typepath/*FAST]*/);
          return;

        case "ulong":

          if (data < 0 || data > 18446744073709551615 || !Number.isInteger(data))
            sjot_error("value", data, type/*FAST[*/, datapath, typepath/*FAST]*/);
          return;

        default:

          if (typeof type !== "string")
            sjot_error("value", data, type/*FAST[*/, datapath, typepath/*FAST]*/);

          // check numeric ranges n..m,n..,..m,<n..m>,<n..,..m>,n
          // may not reject non-integers in e.g. "1.0" or non-floats in e.g. "1" because JS numbers are floats
          // TODO perhaps use a regex instead of (or with) a loop to improve performance?
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

      sjot_error("value", data, type/*FAST[*/, datapath, typepath/*FAST]*/);

    case "string":

      // validate a string
      if (type === "string" || type === "char[]" || type === "atom")
        return;
      if (typeof type !== "string")
        sjot_error("value", data, type/*FAST[*/, datapath, typepath/*FAST]*/);

      if (type.startsWith("(")) {

        // check regex
        if (RegExp("^" + type + "$").test(data))
          return;

      } else if (type.startsWith("char")) {

        if (type === "char") {

          if (data.length === 1)
            return;

        } else {

          return sjot_validate_bounds(data.length, type, 5/*FAST[*/, datapath, typepath/*FAST]*/);

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

          case "uuid":

            // check uuid
            if (/^(urn:uuid:)?[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}$/.test(data))
              return;
            break;

          case "date":

            // check RFC3999 date part
            if (/^\d{4}-\d{2}-\d{2}$/.test(data))
              return;
            break;

          case "time":

            // check RFC3999 time part
            if (/^\d{2}:\d{2}:\d{2}(\.\d{1,6})?([-+]\d{2}:?\d{2}|Z)?$/.test(data))
              return;
            break;

          case "datetime":

            // check RFC3999 datetime
            if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?([-+]\d{2}:?\d{2}|Z)?$/.test(data))
              return;
            break;

          case "duration":

            // check ISO 8601 duration
            if (/^-?P(-?[0-9,.]*Y)?(-?[0-9,.]*M)?(-?[0-9,.]*W)?(-?[0-9,.]*D)?(T(-?[0-9,.]*H)?(-?[0-9,.]*M)?(-?[0-9,.]*S)?)?$/.test(data))
              return;
            break;

        }

      }

      sjot_error("value", data, type/*FAST[*/, datapath, typepath/*FAST]*/);

    default:

      sjot_schema_error("is not a valid type"/*FAST[*/, typepath + "/" + type/*FAST]*/);

  }

}

// union validation, used in sjot_validate()
function sjot_validate_union(sjots, data, type, sjot/*FAST[*/, datapath, typepath/*FAST]*/) {

  var union = [];

  // check if union has distinct arrays and objects, this tells us which type we can pick to validate data against
  for (var itemtype of type[0])
    sjot_check_union(sjots, itemtype, itemtype, sjot/*FAST[*/, typepath + "/" + itemtype/*FAST]*/, union, 1);

  // n is the depth of array nestings + 1
  var n = 1;
  var item = data;

  while (Array.isArray(item)) {

    n++;

    if (item.length === 0) {

      if ((union[0] !== undefined && n >= union[0]) || union[n] !== undefined)
        return;
      sjot_error("value", data, type/*FAST[*/, datapath, typepath/*FAST]*/);

    }

    item = item[0];

  }

  // everything is "any" when array depth n >= union[0], so we're done
  if (union[0] !== undefined && n >= union[0])
    return;

  if (union[n] !== undefined) {

    if (item === null) {

      if (union[n].n === null)
        sjot_error("value", data, type/*FAST[*/, datapath, typepath/*FAST]*/);
      return sjot_validate(sjots, data, union[n].n, sjot/*FAST[*/, typepath + "/" + union[n].n/*FAST]*/);

    }

    switch (typeof item) {

      case "boolean":

        if (union[n].b !== null) {

          if (n > 1)
            return sjot_validate(sjots, data, union[n].b, sjot/*FAST[*/, typepath + "/" + union[n].b/*FAST]*/);

          for (var itemtype of type[0]) {

            try {

              return sjot_validate(sjots, data, itemtype, sjot/*FAST[*/, typepath + "/" + itemtype/*FAST]*/);

            } catch (e) {

            }

          }

        }

        break;

      case "number":

        if (union[n].x !== null) {

          if (n > 1)
            return sjot_validate(sjots, data, union[n].x, sjot/*FAST[*/, typepath + "/" + union[n].x/*FAST]*/);

          for (var itemtype of type[0]) {

            try {

              return sjot_validate(sjots, data, itemtype, sjot/*FAST[*/, typepath + "/" + itemtype/*FAST]*/);

            } catch (e) {

            }

          }

        }

        break;

      case "string":

        if (union[n].s !== null) {

          if (n > 1)
            return sjot_validate(sjots, data, union[n].s, sjot/*FAST[*/, typepath + "/" + union[n].s/*FAST]*/);

          for (var itemtype of type[0]) {

            try {

              return sjot_validate(sjots, data, itemtype, sjot/*FAST[*/, typepath + "/" + itemtype/*FAST]*/);

            } catch (e) {

            }

          }

        }

        break;

      case "object":

        if (union[n].o !== null)
          return sjot_validate(sjots, data, union[n].o, sjot/*FAST[*/, typepath + "/" + union[n].o/*FAST]*/);

        if (union[n].p !== null) {

          for (var prop in item)
            if (union[n].p.hasOwnProperty(prop))
              return sjot_validate(sjots, data, union[n].p[prop], sjot/*FAST[*/, typepath + "/" + union[n].p[prop]/*FAST]*/);
          for (var prop in union[n].p)
            if (union[n].p.hasOwnProperty(prop))
              return sjot_validate(sjots, data, union[n].p[prop], sjot/*FAST[*/, typepath + "/" + union[n].p[prop]/*FAST]*/);

        }

    }

  }

  sjot_error("value", data, type/*FAST[*/, datapath, typepath/*FAST]*/);

}

// check array/set/string bounds, used in sjot_validate()
function sjot_validate_bounds(len, type, i/*FAST[*/, datapath, typepath/*FAST]*/) {

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
      sjot_error("length", len, type/*FAST[*/, datapath, typepath/*FAST]*/);

  } else if (k + 1 === j) {

    // check [n,]
    var n = Number.parseInt(type.slice(i, k));

    if (len < n)
      sjot_error("length", len, type/*FAST[*/, datapath, typepath/*FAST]*/);

  } else if (i === k) {

    // check [,m]
    var m = Number.parseInt(type.slice(k + 1, j));

    if (len > m)
      sjot_error("length", len, type/*FAST[*/, datapath, typepath/*FAST]*/);

  } else {

    // check [n,m]
    var n = Number.parseInt(type.slice(i, k));
    var m = Number.parseInt(type.slice(k + 1, j));

    if (len < n || len > m)
      sjot_error("length", len, type/*FAST[*/, datapath, typepath/*FAST]*/);

  }

}

// extend object type by recursively expanding base object types, setting @extends to undefined
function sjot_extends(sjots, type, sjot/*FAST[*/, typepath/*FAST]*/) {

  // put @extends base properties into this object type
  if (type.hasOwnProperty('@extends')) {

    var basetype = type['@extends'];

    // mark visited/expanded
    type['@extends'] = undefined;

    if (basetype === undefined)
      return;

    if (typeof basetype !== "string")
      sjot_schema_error("@extends does not refer to an object"/*FAST[*/, typepath/*FAST]*/);

    // get referenced URI#name base type
    var base = sjot_reftype(sjots, basetype, sjot/*FAST[*/, typepath/*FAST]*/);

    if (typeof base !== "object")
      sjot_schema_error("@extends does not refer to an object"/*FAST[*/, typepath/*FAST]*/);

    // recursively expand
    sjot_extends(sjots, base, sjot/*FAST[*/, typepath/*FAST]*/);

    for (var prop in base) {

      if (base.hasOwnProperty(prop)) {

        if (prop.startsWith("@")) {

          switch (prop) {

            case "@final":

              if (base[prop])
                sjot_schema_error("@extends " + basetype + " that is final"/*FAST[*/, typepath/*FAST]*/);
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
            sjot_schema_error("overriding of " + basetype + "/" + prop + " is not permitted"/*FAST[*/, typepath + "/" + prop/*FAST]*/);

          type[prop] = base[prop];

        }

      }

    }

  }

}

// get schema root type
function sjot_roottype(sjot) {

  if (sjot.hasOwnProperty('@root')) {

    var type = sjot['@root'];

    if (typeof type !== "string" || !type.endsWith("#"))
      return type;
    sjot_schema_error("root refers to a root"/*FAST[*/, "schema"/*FAST]*/);

  }

  for (var prop in sjot)
    if (sjot.hasOwnProperty(prop) && !prop.startsWith("@"))
      return sjot[prop];

  sjot_schema_error("has no root type"/*FAST[*/, "schema"/*FAST]*/);

}

// get referenced type from type reference [URI]#[type]
function sjot_reftype(sjots, type, sjot/*FAST[*/, typepath/*FAST]*/) {

  var h = type.indexOf("#");
  var prop = type.slice(h + 1);

  if (h <= 0) {

    // local reference to root # in non-id schema
    if (prop === "")
      return sjot_roottype(sjot);
    // local reference #type in non-id schema (prop = type)
    if (!sjot.hasOwnProperty(prop))
      sjot_schema_error("missing named type referenced by " + prop/*FAST[*/, typepath + "/" + type/*FAST]*/);
    type = sjot[prop];
    if (typeof type === "string" && type.indexOf("#") !== -1 && !type.startsWith("(") && !(type.endsWith("]") || type.endsWith("}")))
      sjot_schema_error("spaghetti references to named types not permitted"/*FAST[*/, typepath + "/" + type/*FAST]*/);
    return type;

  } else {

    // reference URI#[type]
    for (var sjoot of sjots) {

      if (sjoot.hasOwnProperty('@id') && type.startsWith(sjoot['@id']) && sjoot['@id'].length === h) {

        // type reference # to root
        if (prop === "")
          return sjot_roottype(sjoot);
        // reference URI#type (prop = type)
        if (!sjoot.hasOwnProperty(prop))
          sjot_schema_error("schema " + sjoot['@id'] + " missing named type referenced by " + prop/*FAST[*/, typepath + "/" + type/*FAST]*/);
        type = sjoot[prop];
        if (typeof type === "string" && type.indexOf("#") !== -1 && !type.startsWith("(") && !(type.endsWith("]") || type.endsWith("}")))
          sjot_schema_error("spaghetti references to named types not permitted"/*FAST[*/, typepath + "/" + type/*FAST]*/);
        return type;

      }

    }

    // TODO get external URI type reference when URI is a URL, load and put in sjots array
    // throw "No type " + prop + " found at " + type.slice(0, h - 1) + " referenced by "/*FAST[*/ + typepath + "/"/*FAST]*/ + type;

    var URL = type.slice(0, h);

    try {

      var sjoot = sjot_load(URL);

      if (sjoot.hasOwnProperty('@id') && sjoot['@id'] !== URL)
        sjot_schema_error("schema \"" + URL + "\" load error due to @id URL mismatch"/*FAST[*/, typepath + "/" + type/*FAST]*/);
      sjoot['@id'] = URL;
      sjots = sjots.concat(sjoot);
      return sjot_reftype(sjots, type, sjot/*FAST[*/, typepath/*FAST]*/);

    } catch (e) {

      sjot_schema_error("no type " + prop + " found in \"" + URL + "\" " + e/*FAST[*/, typepath + "/" + type/*FAST]*/);
    }

  }

}

// load JSON from file
function sjot_load(file) {

  var json;
  var load = function(file, callback) {

    var xobj = new XMLHttpRequest();

    xobj.overrideMimeType("application/json");
    xobj.open('GET', file, false); // uses deprecated synchronous load, WHICH IS WHAT WE WANT

    xobj.onreadystatechange = function() {

      if (xobj.readyState == 4 && xobj.status == "200")
        callback(xobj.responseText);

    };

    xobj.send(null);

  }

  load(file, function(response) { json = JSON.parse(response); });
  return json;

}

// return default value of a type (0 for numbers, "" for strings, false for boolean, null for "null" and anything else)
function sjot_default(value, sjots, data, type, sjot/*FAST[*/, datapath, typepath/*FAST]*/) {

  if (typeof type !== "string" || type.endsWith("]") || type.endsWith("}"))
    return null;
  if (type.indexOf("#") !== -1 && !type.startsWith("("))
    type = sjot_reftype(sjots, type, sjot/*FAST[*/, typepath/*FAST]*/);
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

      return value === "null" ? 0 : Number.parseFloat(value);

    case "object":
    case "array":

      return null;

    default:

      // check type for numeric range and if so set number, not string
      if (!type.startsWith("(") && /\d/.test(type))
        return value === "null" ? 0 : Number.parseFloat(value);
      return value === "null" ? "" : value;

  }

}

// throw descriptive error message
function sjot_error(what, data, type/*FAST[*/, datapath, typepath/*FAST]*/) {

  var a = "is not an object ";

  if (type === "")
    a = "";
  else if (Array.isArray(type))
    a = type.length === 0 ? "is not an array " : type.length === 1 && Array.isArray(type[0]) ? "is not one of " : "is not an array of ";
  else if (typeof type === "string")
    a = type.endsWith("]") ? "is not an array " : type.endsWith("}") ? "is not a set " : "is not of type "
  else
    type = "";

  var b =/*FAST[*/ typepath !== "" ? (type === "" ? "as required by " : " required by ") + typepath :/*FAST]*/ "";

  if (typeof data === "string")
    throw /*FAST[*/datapath +/*FAST]*/ " " + what + " \"" + data + "\" " + a + type + b;
  else if (typeof data === "number" || typeof data === "boolean" || data === null)
    throw /*FAST[*/datapath +/*FAST]*/ " " + what + " " + data + " " + a + type + b;
  else
    throw /*FAST[*/datapath +/*FAST]*/ " " + what + " " + a + type + b;

}

/*LEAN[*/
// check schema compliance and correctness (an optional feature, can be removed for compact SJOT libraries)
function sjot_check(sjots, root, prim, type, sjot/*FAST[*/, typepath/*FAST]*/) {

  switch (typeof type) {

    case "object":

      if (type === null || type === undefined)
        sjot_schema_error("is not a valid type"/*FAST[*/, typepath + "/" + type/*FAST]*/);

      if (root)
        sjot_roottype(sjot);

      if (prim)
        sjot_schema_error("is not a primitive type"/*FAST[*/, typepath/*FAST]*/);

      if (Array.isArray(type)) {

        if (sjot_is_union(type)) {

          // check union
          var union = [];

          for (var itemtype of type[0]) {

            sjot_check(sjots, false, prim, itemtype, sjot/*FAST[*/, typepath + "/" + itemtype/*FAST]*/);
            sjot_check_union(sjots, itemtype, itemtype, sjot/*FAST[*/, typepath + "/" + itemtype/*FAST]*/, union, 1);

          }

        } else if (type.length === 0) {

        } else if (type.length === 1) {

          // check array [type] or [m]
          if (typeof type[0] === "number") {

            if (type[0] < 0)
              sjot_schema_error("array size is negative"/*FAST[*/, typepath + "[" + type[0] + "]"/*FAST]*/);

          } else {

            sjot_check(sjots, false, false, type[0], sjot/*FAST[*/, typepath/*FAST]*/);

          }

        } else if (typeof type[1] === "number") {

          // check array [n,m] or [type,m]
          if (type[1] < 0)
            sjot_schema_error("array size is negative"/*FAST[*/, typepath + "[" + type[0] + "," + type[1] + "]"/*FAST]*/);

          if (typeof type[0] === "number") {

            if (type[0] < 0)
              sjot_schema_error("array size is negative"/*FAST[*/, typepath + "[" + type[0] + "," + type[1] + "]"/*FAST]*/);

          } else {

            sjot_check(sjots, false, false, type[0], sjot/*FAST[*/, typepath/*FAST]*/);

          }

        } else if (typeof type[0] === "number") {

          // check array [n,type] or [n,type,m]
          if (type[0] < 0)
            sjot_schema_error("array size is negative"/*FAST[*/, typepath + "[" + type[0] + "," + type[1] + "]"/*FAST]*/);
          if (type.length > 2 && typeof type[2] === "number" && type[2] < type[0])
            sjot_schema_error("array size is negative"/*FAST[*/, typepath + "[" + type[0] + "," + type[1] + "," + type[2] + "]"/*FAST]*/);
          sjot_check(sjots, false, false, type[1], sjot/*FAST[*/, typepath/*FAST]*/);


        } else if (type.length > 0) {

          // check tuple
          for (var i = 0; i < type.length; i++)
            sjot_check(sjots, false, false, type[i], sjot,/*FAST[*/ typepath +/*FAST]*/ "[" + i + "]");

        }

      } else {

        // put @extends base properties into this object type
        sjot_extends(sjots, type, sjot/*FAST[*/, typepath/*FAST]*/);

        for (var prop in type) {

          // reject @root and @id in objects
          if (prop === "@root") {

            if (!root)
              sjot_schema_error("@root is used in an object (redefine as a regex)"/*FAST[*/, typepath/*FAST]*/);
            sjot_check(sjots, false, false, type[prop], sjot,/*FAST[*/ typepath +/*FAST]*/ "/@root");

          } else if (prop === "@id") {

            // check @id is a string
            if (!root)
              sjot_schema_error("@id is used in an object (redefine as a regex)"/*FAST[*/, typepath/*FAST]*/);
            if (typeof type[prop] !== "string")
              sjot_schema_error("@id value is not a string"/*FAST[*/, typepath/*FAST]*/);

          } else if (prop === "@note") {

            if (typeof type[prop] !== "string")
              sjot_schema_error("@note value is not a string"/*FAST[*/, typepath/*FAST]*/);

          } else if (prop === "@extends") {

            // has undefined value (by sjot_extends) so can ignore

          } else if (prop === "@final") {

            // check @final is true or false
            if (typeof type[prop] !== "boolean")
              sjot_schema_error("@final value is not true or false"/*FAST[*/, typepath/*FAST]*/);

          } else if (prop === "@one" || prop === "@any" || prop === "@all" || prop === "@dep") {

            var propsets = type[prop];
            var temp = {};

            if (prop !== "@dep") {

              if (!Array.isArray(propsets))
                sjot_schema_error("is not an array of property sets"/*FAST[*/, typepath + "/" + prop/*FAST]*/);

              // check if the propsets are disjoint
              for (var propset of propsets) {

                if (!Array.isArray(propset))
                  sjot_schema_error("is not an array of property sets"/*FAST[*/, typepath + "/" + prop/*FAST]*/);

                for (var name of propset) {

                  if (typeof name !== "string" || name.startsWith("@") || name.startsWith("("))
                    sjot_schema_error("is not an array of property sets"/*FAST[*/, typepath + "/" + prop/*FAST]*/);
                  if (temp[name] === false)
                    sjot_schema_error("property sets are not disjoint"/*FAST[*/, typepath + "/" + prop/*FAST]*/);
                  temp[name] = false;

                }

              }

            } else {

              for (var name in propsets) {

                if (propsets.hasOwnProperty(name)) {

                  temp[name] = false;
                  if (typeof propsets[name] === "string")
                    temp[propsets[name]] = false;
                  else if (Array.isArray(propsets[name]) && propsets[name].every(function (prop) { return typeof prop === "string"; }))
                    propsets[name].forEach(function (prop) { temp[prop] = false; });
                  else
                    sjot_schema_error("malformed @dep dependencies"/*FAST[*/, typepath + "/" + prop/*FAST]*/);

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
                sjot_schema_error("property set contains property " + name + " that is not an optional non-default property of this object"/*FAST[*/, typepath + "/" + prop/*FAST]*/);

          } else if (prop.startsWith("(")) {

            try {

              RegExp(prop);

            } catch (e) {

              sjot_schema_error(e/*FAST[*/, typepath + "/" + prop/*FAST]*/);

            }

          } else if (root && prop.endsWith("]") || prop.endsWith("}")) {

            // property names cannot end in a "]" or a "}" (users should use a regex in this case!)
            sjot_schema_error("name ends with a ] or a } (use a regex for this property name instead)"/*FAST[*/, typepath + "/" + prop/*FAST]*/);

          } else {

            var i = prop.indexOf("?");

            // check property type (primitive=true when optional with a default value)
            sjot_check(sjots, false, (i !== -1 && i < prop.length - 1), type[prop], sjot,/*FAST[*/ typepath + "/" +/*FAST]*/ prop);

          }

        }

        /*FAST[*/
        if (!sjot_check_satisfiable(
              type.hasOwnProperty("@one") ? type["@one"] : [],
              type.hasOwnProperty("@any") ? type["@any"] : [],
              type.hasOwnProperty("@all") ? type["@all"] : [],
              type.hasOwnProperty("@dep") ? type["@dep"] : {}))
          sjot_schema_error("has non-satisfiable constraints and rejects all data"/*FAST[*/, typepath/*FAST]*/);
        /*FAST]*/

      }

      break;

    case "string":

      if (root)
        sjot_schema_error("is not a SJOT schema object"/*FAST[*/, typepath + "/" + typeof type/*FAST]*/);

      if (type.indexOf("#") !== -1 && !type.startsWith("(") && !type.endsWith("]") && !type.endsWith("}")) {

        var reftype = sjot_reftype(sjots, type, sjot/*FAST[*/, typepath/*FAST]*/);

        if (prim)
          return sjot_check(sjots, false, true, reftype, sjot/*FAST[*/, typepath + "/" + type/*FAST]*/);
        return;

      } else if (type.endsWith("]")) {

        var i = type.lastIndexOf("[");

        if (i === -1)
          sjot_schema_error("missing ["/*FAST[*/, typepath + "/" + type/*FAST]*/);

        var primtype = type.slice(0, i);

        if (prim && primtype !== "char")
          sjot_schema_error("is not a primitive type"/*FAST[*/, typepath + "/" + type/*FAST]*/);
        return sjot_check(sjots, false, false, type.slice(0, i), sjot/*FAST[*/, typepath/*FAST]*/);

      } else if (type.endsWith("}")) {

        if (prim)
          sjot_schema_error("is not a primitive type"/*FAST[*/, typepath + "/" + type/*FAST]*/);

        var i = type.lastIndexOf("{");

        if (i === -1)
          sjot_schema_error("missing {"/*FAST[*/, typepath + "/" + type/*FAST]*/);
        return sjot_check(sjots, false, true, type.slice(0, i), sjot/*FAST[*/, typepath/*FAST]*/);

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
          case "base64":
          case "hex":
          case "uuid":
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
              sjot_schema_error("is not a primitive type"/*FAST[*/, typepath + "/" + type/*FAST]*/);
            break;


          default:

            if (type.startsWith("(")) {

              try {

                RegExp(type);

              } catch (e) {

                sjot_schema_error(e/*FAST[*/, typepath + "/" + type/*FAST]*/);

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
                      sjot_schema_error("is not a valid range"/*FAST[*/, typepath + "/" + type/*FAST]*/);

                  } else {

                    // check ..m
                    if (isNaN(Number.parseFloat(type.slice(j + 2, k))))
                      sjot_schema_error("is not a valid range"/*FAST[*/, typepath + "/" + type/*FAST]*/);

                  }

                } else if (j < k && j !== -1 ) {

                  if (j + 2 === k) {

                    // check n.. and <n..
                    if (isNaN(Number.parseFloat(type.slice(i, j))))
                      sjot_schema_error("is not a valid range"/*FAST[*/, typepath + "/" + type/*FAST]*/);

                  } else {

                    var n, m;

                    n = Number.parseFloat(type.slice(i, j));
                    if (isNaN(n))
                      sjot_schema_error("is not a valid range"/*FAST[*/, typepath + "/" + type/*FAST]*/);

                    if (type.charCodeAt(k - 1) === 0x3E) {

                      // check n..m> and <n..m>
                      e = true;
                      m = Number.parseFloat(type.slice(j + 2, k - 1));
                      if (isNaN(m))
                        sjot_schema_error("is not a valid range"/*FAST[*/, typepath + "/" + type/*FAST]*/);

                    } else {

                      // check n..m and <n..m
                      m = Number.parseFloat(type.slice(j + 2, k));
                      if (isNaN(m))
                        sjot_schema_error("is not a valid range"/*FAST[*/, typepath + "/" + type/*FAST]*/);

                    }

                    if (n > m || (e && n === m))
                      sjot_schema_error("has an empty range " + n + ".." + m/*FAST[*/, typepath + "/" + type/*FAST]*/);

                  }

                } else {

                  // check n
                  if (isNaN(Number.parseFloat(type.slice(i, k))))
                    sjot_schema_error("is not a valid type"/*FAST[*/, typepath + "/" + type/*FAST]*/);

                }

                i = k;

              }

            }

        }

      }

      break;

    default:

      if (root)
        sjot_schema_error("is not a SJOT schema object"/*FAST[*/, typepath + "/" + typeof type/*FAST]*/);

      sjot_schema_error("is not a valid type"/*FAST[*/, typepath + "/" + type/*FAST]*/);

  }

}
/*LEAN]*/

// returns true if type is a union [[ type, type, ... ]]
function sjot_is_union(type) {

  return Array.isArray(type) &&
    type.length === 1 &&
    Array.isArray(type[0]) &&
    type[0].length > 1 &&
    typeof type[0] !== "number" &&
    typeof type[1] !== "number";

}

// check if union [[ type, type, ... ]] has distinct array and object types
function sjot_check_union(sjots, type, itemtype, sjot/*FAST[*/, typepath/*FAST]*/, union, n) {

  // count array depth, each depth has its own type conflict set
  if (typeof itemtype === "string") {

    var i = itemtype.length;

    while (i > 0) {

      if (itemtype.charCodeAt(i - 1) === 0x5D)
        i = itemtype.lastIndexOf("[", i - 1);
      else if (type.charCodeAt(i - 1) === 0x7D)
        i = itemtype.lastIndexOf("{", i - 1);
      else
        break;
      n++;

    }

    // n is array depth, now get item type and check if this is a type reference
    itemtype = itemtype.slice(0, i);

    if (itemtype.indexOf("#") !== -1 && !itemtype.startsWith("("))
      return sjot_check_union(
          sjots,
          type,
          sjot_reftype(sjots, itemtype, sjot/*FAST[*/, typepath/*FAST]*/),
          sjot,
          /*FAST[*/typepath,/*FAST]*/
          union,
          n);

  }

  if (itemtype === "char" && n > 0) {

    // "char[]" is a special case, synonymous to "string"
    n--;
    itemtype = "string";

  } else if (itemtype === "array") {

    // "array" is synonymous to "any[]"
    n++;
    itemtype = "any";

  } else if (Array.isArray(itemtype)) {

    if (itemtype.length === 0 || itemtype === "array") {

      n++;
      itemtype = "any";

    } else if (itemtype.length === 1 || typeof itemtype[1] === "number") {

      // nested unions, including arrays of unions, are not permitted
      if (sjot_is_union(itemtype))
        sjot_schema_error("nested unions are not permitted"/*FAST[*/, typepath/*FAST]*/);

      n++;
      if (typeof itemtype[0] === "number")
        itemtype = "any";
      else
        return sjot_check_union(sjots, type, itemtype[0], sjot/*FAST[*/, typepath/*FAST]*/, union, n);

    } else if (typeof itemtype[0] === "number") {

      n++;
      if (typeof itemtype[1] === "number")
        itemtype = "any";
      else
        return sjot_check_union(sjots, type, itemtype[1], sjot/*FAST[*/, typepath/*FAST]*/, union, n);

    } else {

      // tuple is represented by "any[]"
      n++;
      itemtype = "any";

    }

  }

  // union[0] is the cut-off array depth where everything is "any" and will conflict
  if (union[0] !== undefined && n >= union[0])
    sjot_schema_error("union requires distinct types"/*FAST[*/, typepath/*FAST]*/);

  // record null, boolean, number, string, and object types with property mapping for conflict checking at array depth n
  if (union[n] === undefined)
    union[n] = { n: null, b: null, x: null, s: null, o: null, p: null };

  if (typeof itemtype === "string") {

    switch (itemtype) {

      case "null":

        if (union[n].n !== null)
          sjot_schema_error("union has multiple null types"/*FAST[*/, typepath/*FAST]*/);
        union[n].n = type;
        break;

      case "boolean":
      case "true":
      case "false":

        if (n > 1 && union[n].b !== null)
          sjot_schema_error("union has multiple boolean types"/*FAST[*/, typepath/*FAST]*/);
        union[n].b = type;
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

        if (n > 1 && union[n].x !== null)
          sjot_schema_error("union has multiple numeric types"/*FAST[*/, typepath/*FAST]*/);
        union[n].x = type;
        break;

      case "string":
      case "base64":
      case "hex":
      case "uuid":
      case "date":
      case "time":
      case "datetime":
      case "duration":
      case "char":

        if (n > 1 && union[n].s !== null)
          sjot_schema_error("union has multiple string types"/*FAST[*/, typepath/*FAST]*/);
        union[n].s = type;
        break;

      case "any":

        for (var i = n; i < union.length; i++)
          if (union[i] !== undefined && (union[i].n !== null || union[i].b !== null || union[i].x !== null || union[i].s !== null || union[i].o !== null || union[i].p !== null))
            sjot_schema_error("union requires distinct types"/*FAST[*/, typepath/*FAST]*/);
        union[0] = n;
        break;

      case "atom":

        if (union[n].b !== null || union[n].x !== null || union[n].s !== null)
          sjot_schema_error("union has multiple atomic types"/*FAST[*/, typepath/*FAST]*/);
        union[n].b = type;
        union[n].x = type;
        union[n].s = type;
        break;

      case "object":

        if (union[n].o !== null || union[n].p !== null)
          sjot_schema_error("union has multiple object types"/*FAST[*/, typepath/*FAST]*/);
        union[n].o = type;
        break;

      default:

        if (itemtype.startsWith("(")) {

          if (n > 1 && union[n].s !== null)
            sjot_schema_error("union has multiple string array types"/*FAST[*/, typepath/*FAST]*/);
          union[n].s = type;

        } else {

          if (n > 1 && union[n].x !== null)
            sjot_schema_error("union has multiple numeric array types"/*FAST[*/, typepath/*FAST]*/);
          union[n].x = type;

        }

    }

  } else if (typeof itemtype === "object") {

    if (union[n].o !== null)
      sjot_schema_error("union requires distinct object types"/*FAST[*/, typepath/*FAST]*/);

    if (union[n].p === null)
      union[n].p = {};

    for (var prop in itemtype) {

      if (!prop.startsWith('@') && itemtype.hasOwnProperty(prop)) {

        if (prop.startsWith("(")) {

          // object with regex property means only one such object is permitted in the union to ensure uniqueness
          if (union[n].o !== null)
            sjot_schema_error("union requires distinct object types"/*FAST[*/, typepath/*FAST]*/);
          union[n].o = type;
          break;

        } else {

          var i = prop.indexOf("?");

          if (i !== -1)
            prop = prop.slice(0, i);
          if (union[n].p.hasOwnProperty(prop))
            sjot_schema_error("union requires distinct object types"/*FAST[*/, typepath/*FAST]*/);
          union[n].p[prop] = type;

        }

      }

    }

  }

}

function sjot_schema_error(msg/*FAST[*/, typepath/*FAST]*/) {
  throw "SJOT schema error: "/*FAST[*/ + typepath + " "/*FAST]*/ + msg;
}

/*LEAN[*/
/*FAST[*/
// SJOT schema model checker: check if constraints are satisfiable, takes 2^n time to test n distinct variables in constraints
// returns true if the model is satisfiable
// returns false when the schema for this object rejects all data, but cuts off checking and returns true when over 20 distinct variables from @one, @any, @all, @dep are collected per object
function sjot_check_satisfiable(one, any, all, dep) {

  var bits = {};

  one.forEach(function (props) { props.forEach(function (prop) { bits[prop] = false; }); });
  any.forEach(function (props) { props.forEach(function (prop) { bits[prop] = false; }); });
  all.forEach(function (props) { props.forEach(function (prop) { bits[prop] = false; }); });

  for (var prop in dep) {

    if (dep.hasOwnProperty(prop)) {

      bits[prop] = false;
      if (typeof dep[prop] === "string")
        bits[dep[prop]] = false;
      else
        dep[prop].forEach(function (prop) { bits[prop] = false; });

    }

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
          (!Array.isArray(dep[prop]) || !dep[prop].every(function (prop) { return bits[prop]; })))
        continue loop;
    return true;

  }

  return false;

}
/*FAST]*/
/*LEAN]*/

