/**
 * Convert SJOT to JSON schema v1, v3 and v4
 *
 * @module      sjot2js
 * @version     {VERSION}
 * @class       SJOT2JS
 * @requires    sjot.js
 * @author      Robert van Engelen, engelen@genivia.com
 * @copyright   Robert van Engelen, Genivia Inc, 2016. All Rights Reserved.
 * @license     BSD3
 * @link        http://sjot.org
 */


/*
   Requires sjot.js SJOT class

   Usage

var SJOT = require("sjot");     // npm sjot package for node.js

var schema = {
  "Data": {
    "name":    "string",        // required name of type string
    "v?1.0":   "number",        // optional v with default 1.0
    "tags?":   "string{1,}",    // optional non-empty set of string tags
    "package": { "id": "1..", "name": "char[1,]" }
   }                            // package.id >= 1, non-empty package.name
};

// SJOT2JS.toJSONSchema(schema [, version]):

var JSONSchemaV4 = SJOT2JS.toJSONSchema(schema, 4);

*/

"use strict";

class SJOT2JS {

  static toJSONSchema(schema, version) {

    var sjots = schema;

    if (typeof schema === "string")
      sjots = JSON.parse(schema);

    if (Array.isArray(sjots)) {

      var schemas = [];

      for (var i = 0; i < sjots.length; i++)
        schemas.push(sjot_2js(sjots, true, version, sjots[i], sjots[i]));
      return schemas;

    } else {

      return sjot_2js([sjots], true, version, sjots, sjots);

    }

  }

}

function sjot_ref2js(sjots, type, sjot) {

  var h = type.indexOf("#");
  var prop = type.slice(h + 1);

  if (h === -1) {

    // local reference #type
    if (sjot.hasOwnProperty("@root"))
      return "#/definitions/" + prop;
    else
      return "#";

  } else {

    // reference URI#type
    if (!sjot.hasOwnProperty("@id") || !type.startsWith(sjot["@id"]) || sjot["@id"].length !== h)
      for (var sjoot of sjots)
        if (sjoot.hasOwnProperty('@id') && type.startsWith(sjoot['@id']) && sjoot['@id'].length === h)
          return type.slice(0, h) + "#/definitions/" + prop;

  }

  return "#/definitions/" + prop;

}

function sjot_2js(sjots, root, version, type, sjot) {

  switch (typeof type) {

    case "object":

      if (Array.isArray(type)) {

        if (sjot_is_union(type)) {

          // convert union
          var union = [];

          for (var itemtype of type[0]) {

            if (typeof itemtype !== null && typeof itemtype === "object" && itemtype.hasOwnProperty("@if") && itemtype.hasOwnProperty("@then"))
                union.push(sjot_2js(sjots, false, version, itemtype["@then"], sjot));
            else
              union.push(sjot_2js(sjots, false, version, itemtype, sjot));
            
          }

          if (version >= 4)
            return { anyOf: union };
          else
            return union;

        } else if (type.length == 0) {

          // convert array []
          return { type: "array" };

        } else if (type.length === 1) {

          // convert array [type] or [m]
          if (typeof type[0] === "number")
            return { type: "array", minItems: type[0], maxItems: type[0] };
          else
            return { type: "array", items: sjot_2js(sjots, false, version, type[0], sjot) };

        } else if (typeof type[1] === "number") {

          // convert array [n,m] or [type,m]
          if (typeof type[0] === "number")
            return { type: "array", minItems: type[0], maxItems: type[1] };
          else
            return { type: "array", items: sjot_2js(sjots, false, version, type[0], sjot), maxItems: type[1] };

        } else if (typeof type[0] === "number") {

          // convert array [n,type] or [n,type,m]
          if (type.length > 2 && typeof type[2] === "number")
            return { type: "array", items: sjot_2js(sjots, false, version, type[1], sjot), minItems: type[0], maxItems: type[2] };
          else
            return { type: "array", items: sjot_2js(sjots, false, version, type[1], sjot), minItems: type[0] };

        } else {

          // convert tuple
          var tuple = [];

          for (var itemtype of type)
            tuple.push(sjot_2js(sjots, false, version, itemtype, sjot));
          return { type: "array", items: tuple, additionalItems: false };

        }

      } else if (root) {

        // root schema type
        var schema = {};
        
        if (version === undefined || typeof version !== "number" || version < 3)
          schema["$schema"] = "http://json-schema.org/schema#";
        else if (version === 3)
          schema["$schema"] = "http://json-schema.org/draft-03/schema#";
        else
          schema["$schema"] = "http://json-schema.org/draft-04/schema#";

        if (type.hasOwnProperty("@id"))
          schema.id = type["@id"];
        if (type.hasOwnProperty("@note"))
          schema.description = type["@note"];

        if (type.hasOwnProperty("@root")) {

          var obj = sjot_2js(sjots, false, version, type["@root"], sjot);

          if (typeof obj === "object" && obj.hasOwnProperty("$ref") && obj["$ref"].hasOwnProperty("$ref")) {

            schema["$ref"] = obj["$ref"]["$ref"];

          } else {

            for (var prop in obj)
              if (obj.hasOwnProperty(prop))
                schema[prop] = obj[prop];

          }

          for (var prop in type) {

            if (type.hasOwnProperty(prop) && !prop.startsWith("@")) {

              if (schema.definitions === undefined)
                schema.definitions = {};
              schema.definitions[prop] = sjot_2js(sjots, false, version, type[prop], sjot);

            }

          }

        } else {

          for (var prop in type) {

            if (type.hasOwnProperty(prop) && !prop.startsWith("@")) {

              var obj = sjot_2js(sjots, false, version, type[prop], sjot);

              for (var name in obj)
                if (obj.hasOwnProperty(name))
                  schema[name] = obj[name];

              break;

            }

          }

        }

        return schema;

      } else {

        // convert object and constraints
        var obj = {};
        var one = [];
        var any = [];
        var all = [];
        var req = [];

        if (type.hasOwnProperty("@note"))
          obj.description = type["@note"];
        obj.type = "object";

        // put @extends base properties into this object type
        if (type.hasOwnProperty('@extends'))
          sjot_extends(sjots, type, sjot /*FAST[*/, "#" /*FAST]*/);

        for (var prop in type) {

          if (prop.startsWith("(")) {

            if (obj.patternProperties === undefined)
              obj.patternProperties = {};
            obj.patternProperties["^" + prop.slice(1, prop.length - 1) + "$"] = sjot_2js(sjots, false, version, type[prop], sjot);

          } else if (!prop.startsWith("@")) {
            
            if (obj.properties === undefined)
              obj.properties = {};

            var i = prop.indexOf("?");

            if (i === -1) {

              obj.properties[prop] = sjot_2js(sjots, false, version, type[prop], sjot);
              if (version >= 4)
                req.push(prop);
              else
                obj.properties[prop].required = true;

            } else {

              var objprop = sjot_2js(sjots, false, version, type[prop], sjot);

              obj.properties[prop.slice(0, i)] = objprop;

              if (i < prop.length - 1) {

                var value = prop.slice(i + 1);
                var proptype = type[prop];

                if (typeof proptype === "string" && proptype.indexOf("#") !== -1 && !proptype.startsWith("(") && !(proptype.endsWith("]") || proptype.endsWith("}")))
                  proptype = sjot_reftype(sjots, proptype, sjot/*FAST[*/, "#"/*FAST]*/);

                switch (proptype) {

                  case "boolean":
                  case "true":
                  case "false":

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
                    if (typeof proptype === "string" && !proptype.startsWith("(")) {

                      for (var i = 0; i < proptype.length; i++) {

                        if (proptype.charCodeAt(i) >= 0x30 && proptype.charCodeAt(i) <= 0x39) {

                          value = Number.parseFloat(value);
                          break;

                        }

                      }

                    }

                }

                objprop["default"] = value;

              }

            }

          }

        }

        if (req.length > 0)
          obj.required = req;

        if (version >= 4) {

          var ones = [];

          if (type.hasOwnProperty("@one"))
            for (var propset of type["@one"])
              ones.push( { oneOf: propset.reduce( function (one, prop) { one.push({ required: [prop] }); return one }, [] ) } );
          if (ones.length === 1)
            one = one.concat(ones[0].oneOf);
          else
            all = all.concat(ones);

          var anys = [];

          if (type.hasOwnProperty("@any"))
            for (var propset of type["@any"])
              anys.push( { anyOf: propset.reduce( function (any, prop) { any.push({ required: [prop] }); return any }, [] ) } );
          if (anys.length === 1)
            any = any.concat(anys[0].anyOf);
          else
            all = all.concat(anys);

          var alls = [];

          if (type.hasOwnProperty("@all")) {

            for (var propset of type["@all"]) {

              var set = propset.reduce( function (all, prop) { all.push({ required: [prop] }); return all }, [] );

              alls.push( { oneOf: [ { required: propset }, { not: { anyOf: set } } ] } );

            }
          }

          all = all.concat(alls);
          if (one.length > 0)
            obj.oneOf = one;
          if (any.length > 0)
            obj.anyOf = any;
          if (all.length > 0)
            obj.allOf = all;
        }

        if (type.hasOwnProperty("@dep"))
          obj.dependencies = type["@dep"];
        if (type.hasOwnProperty("@final") && type["@final"])
          obj.additionalProperties = false;

        return obj;

      }

      break;

    case "string":

      if (type.indexOf("#") !== -1 && !type.startsWith("(") && !(type.endsWith("]") || type.endsWith("}"))) {

        return { "$ref": sjot_ref2js(sjots, type, sjot) };

      } else if (type.endsWith("]")) {

        if (type.startsWith("char") && type.indexOf("]") === type.length - 1)
          return sjot_2js_bounds(type, 5, { type: "string" });

        var i = type.lastIndexOf("[");

        return sjot_2js_bounds(type, i + 1, { type: "array", items: sjot_2js(sjots, false, version, type.slice(0, i), sjot) });

      } else if (type.endsWith("}")) {

        var i = type.lastIndexOf("{");

        return sjot_2js_bounds(type, i + 1, { type: "array", items: sjot_2js(sjots, false, version, type.slice(0, i), sjot), uniqueItems: true });

      } else {

        switch (type) {

          case "boolean":
          case "integer":
          case "number":
          case "string":
          case "object":
          case "array":
          case "null":

            return { type: type };

          case "true":
          case "false":

            return { type: "boolean", enum: [ type ] };

          case "any":
            
            return { };

          case "atom":

            return { oneOf: [ { type: "boolean" }, { type: "number"}, { type: "string" } ] };

          case "byte":

            return { type: "integer", minimum: -128, maximum: 127 };

          case "short":

            return { type: "integer", minimum: -32768, maximum: 32767 };

          case "int":

            return { type: "integer", minimum: -2147483648, maximum: 2147483647 };

          case "long":

            return { type: "integer", minimum: -140737488355328, maximum: 2147483647 };

          case "ubyte":

            return { type: "integer", minimum: 0, maximum: 255 };

          case "ushort":

            return { type: "integer", minimum: 0, maximum: 65535 };

          case "uint":

            return { type: "integer", minimum: 0, maximum: 4294967295 };

          case "ulong":

            return { type: "integer", minimum: 0, maximum: 18446744073709551615 };

          case "float":

            return { type: "number", minimum: -3.40282347e38, maximum: 3.40282347e38 };

          case "double":
            
            return { type: "number" };

          case "datetime":
            
            return { type: "date-time" };

          case "base64":

            return { type: "string", pattern: "^[0-9A-Za-z+/]*=?=?$" };

          case "hex":

            return { type: "string", pattern: "^[0-9A-Fa-f]*$" };

          case "uuid":

            return { type: "string", pattern: "^(urn:uuid:)?[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}$" };

          case "date":

            return { type: "string", pattern: "^\d{4}-\d{2}-\d{2}$" };

          case "time":

            return { type: "string", pattern: "^\d{2}:\d{2}:\d{2}(\.\d{1,6})?([+-]\d{2}:\d{2})?$" };

          case "duration":

            return { type: "string", pattern: "^-?P(-?[0-9,.]*Y)?(-?[0-9,.]*M)?(-?[0-9,.]*W)?(-?[0-9,.]*D)?(T(-?[0-9,.]*H)?(-?[0-9,.]*M)?(-?[0-9,.]*S)?)?$" };

          case "char":

            return { type: "string", minLength: 1, maxLength: 1 };

          default:

            if (type.startsWith("(")) {

              return { type: "string", pattern: "^" + type.slice(1, type.length - 1) + "$" }; 

            } else {

              var ranges = [];

              // convert numeric range
              for (var i = 0; i < type.length; i++) {

                var range = {};
                var isfloat = true;

                if (type.charCodeAt(i) === 0x3C) {

                  range.exclusiveMinimum = true;
                  i++;

                }

                var j = type.indexOf("..", i);
                var k = type.indexOf(",", i);

                if (k === -1)
                  k = type.length;

                if (i === j) {

                  var p = type.indexOf(".", j + 2);

                  if (p === -1 || p >= k)
                    isfloat = false;

                  if (type.charCodeAt(k - 1) === 0x3E) {

                    range.maximum = Number.parseFloat(type.slice(j + 2, k - 1));
                    range.exclusiveMaximum = true;

                  } else {

                    range.maximum = Number.parseFloat(type.slice(j + 2, k));

                  }

                } else if (j < k && j !== -1 ) {

                  var p = type.indexOf(".", i);

                  if (p === -1 || p >= j)
                    isfloat = false;

                  if (j + 2 === k) {

                    range.minimum = Number.parseFloat(type.slice(i, j));

                  } else {

                    var p = type.indexOf(".", j + 2);

                    if (p === -1 || p >= k)
                      isfloat = false;

                    range.minimum = Number.parseFloat(type.slice(i, j));

                    if (type.charCodeAt(k - 1) === 0x3E) {

                      range.maximum = Number.parseFloat(type.slice(j + 2, k - 1));
                      range.exclusiveMaximum = true;

                    } else {

                      range.maximum = Number.parseFloat(type.slice(j + 2, k));

                    }

                  }

                } else {

                  range.minimum = Number.parseFloat(type.slice(i, k));
                  range.maximum = range.minimum;

                }

                i = k;

                if (isfloat)
                  range.type = "number";
                else
                  range.type = "integer";

                ranges.push(range);

              }

              if (ranges.length === 1)
                return range;
              else
                return { oneOf: ranges };

            }

        }

      }

    default:

      throw "SJOT schema format error: unknown type " + type;

  }

}

function sjot_2js_bounds(type, i, obj) {

  var j = type.indexOf("]", i);
  var k = type.indexOf(",", i);

  if (j === -1)
    j = type.indexOf("}", i);
  if (j === -1 || i === j)
    return obj;

  if (k === -1)
  {
    var n = Number.parseInt(type.slice(i, j));

    if (obj.type === "array")
      obj.minItems = obj.maxItems = n;
    else
      obj.minLength = obj.maxLength = n;

  } else if (k + 1 === j) {

    var n = Number.parseInt(type.slice(i, k));

    if (obj.type === "array")
      obj.minItems = n;
    else
      obj.minLength = n;

  } else if (i === k) {

    var m = Number.parseInt(type.slice(k + 1, j));

    if (obj.type === "array")
      obj.maxItems = m;
    else
      obj.maxLength = m;

  } else {

    var n = Number.parseInt(type.slice(i, k));
    var m = Number.parseInt(type.slice(k + 1, j));

    if (obj.type === "array") {

      obj.minItems = n;
      obj.maxItems = m;

    } else {

      obj.minLength = n;
      obj.maxLength = m;

    }

  }

  return obj;

}
