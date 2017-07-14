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
 * @link        http:
 */
"use strict";
class SJOT {
  static valid(data, type, schema) {
    try {
      return this.validate(data, type, schema);
    } catch (e) {
      console.log(e);
      return false;
    }
  }
  static validate(data, type, schema) {
    var sjots = schema;
    if (typeof schema === "string")
      sjots = JSON.parse(schema);
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
        sjot_schema_error("is not a SJOT schema object");
    }
    if (Array.isArray(sjots) && sjots.length > 0)
      sjot_validate(sjots, data, type, sjots[0]);
    else
      sjot_validate([sjots], data, type, sjots);
    return true;
  }
  static check(schema) {
    var sjots = schema;
    if (typeof schema === "string")
      sjots = JSON.parse(schema);
  }
}
function sjot_validate(sjots, data, type, sjot) {
  if (type === "any") {
    if (typeof data === "object" && data !== null && data.hasOwnProperty('@sjot')) {
      var sjoot = data['@sjot'];
      if (Array.isArray(sjoot))
        return sjot_validate(sjots.concat(sjoot), data, sjot_roottype(sjoot[0]), sjoot[0]);
      else if (typeof sjoot === "string" && sjoot !== "any" && sjoot !== "object")
        return sjot_validate(sjots, data, sjoot, sjot);
      else if (typeof sjoot === "object")
        return sjot_validate(sjots.concat([sjoot]), data, sjot_roottype(sjoot), sjoot);
      throw "Invalid @sjot schema ";
    }
    return;
  }
  if (typeof type === "string") {
    var h = type.indexOf("#");
    if (h >= 0 && !type.startsWith("(") && !type.endsWith("]") && !type.endsWith("}"))
      return sjot_validate(
          sjots,
          data,
          sjot_reftype(sjots, type, sjot),
          sjot);
  }
  if (sjot_is_union(type))
    return sjot_validate_union(sjots, data, type, sjot);
  switch (typeof data) {
    case "object":
      if (data === null || data === undefined) {
        if (data === null && type === "null")
          return;
        sjot_error("value", data, type);
      } else if (Array.isArray(data)) {
        if (type === "array" || type === "any[]")
          return;
        if (Array.isArray(type)) {
          if (type.length === 0)
            return;
          if (type.length === 1) {
            if (typeof type[0] === "number") {
              if (data.length !== type[0])
                sjot_error("length", type[0], "any");
            } else {
              for (var i = 0; i < data.length; i++) {
                if (data[i] === null)
                  data[i] = sjot_default("null", sjots, null, type[0], sjot);
                sjot_validate(sjots, data[i], type[0], sjot);
              }
            }
          } else if (typeof type[1] === "number") {
            if (data.length > type[1])
              sjot_error("length", type[1], type[0]);
            if (typeof type[0] === "number") {
              if (data.length < type[0])
                sjot_error("length", type[0], "any");
            } else {
              for (var i = 0; i < data.length; i++) {
                if (data[i] === null)
                  data[i] = sjot_default("null", sjots, null, type[0], sjot);
                sjot_validate(sjots, data[i], type[0], sjot);
              }
            }
          } else if (typeof type[0] === "number") {
            if (data.length < type[0])
              sjot_error("length", type[0], type[1]);
            if (type.length > 2 && typeof type[2] === "number") {
              if (data.length > type[2])
                sjot_error("length", type[2], type[1]);
            }
            for (var i = 0; i < data.length; i++) {
              if (data[i] === null)
                data[i] = sjot_default("null", sjots, null, type[1], sjot);
              sjot_validate(sjots, data[i], type[1], sjot);
            }
          } else if (type.length > 0) {
            if (data.length != type.length)
              sjot_error("array of length", data.length, type);
            for (var i = 0; i < data.length; i++) {
              if (data[i] === null)
                data[i] = sjot_default("null", sjots, null, type[i], sjot);
              sjot_validate(sjots, data[i], type[i], sjot);
            }
          }
          return;
        } else if (typeof type === "string") {
          if (type.endsWith("]")) {
            var i = type.lastIndexOf("[");
            var itemtype = type.slice(0, i);
            sjot_validate_bounds(data.length, type, i + 1);
            for (var j = 0; j < data.length; j++) {
              if (data[j] === null)
                data[j] = sjot_default("null", sjots, null, itemtype, sjot);
              sjot_validate(sjots, data[j], itemtype, sjot);
            }
            return;
          } else if (type.endsWith("}")) {
            var i = type.lastIndexOf("{");
            var itemtype = type.slice(0, i);
            if (itemtype.indexOf("#") !== -1 && !itemtype.startsWith("(") && !itemtype.endsWith("]") && !itemtype.endsWith("}")) {
              itemtype = sjot_reftype(sjots, itemtype, sjot);
              if (typeof itemtype !== "string")
                sjot_error("value", data, type);
            }
            var len = data.length;
            data = data.sort().filter(function (e, i, a) { return i === 0 || e !== a[i - 1]; });
            if (data.length !== len)
              sjot_error("value", data, type);
            sjot_validate_bounds(data.length, type, i + 1);
            for (var j = 0; j < data.length; j++) {
              if (data[j] === null)
                data[j] = sjot_default("null", sjots, null, itemtype, sjot);
              sjot_validate(sjots, data[j], itemtype, sjot);
            }
            return;
          }
        }
        sjot_error("value", data, type);
      } else {
        if (type === "object") {
          return sjot_validate(sjots, data, "any", sjot);
        }
        if (type === "date" || type === "time" || type === "datetime") {
          if (!data.constructor.name != "Date")
            sjot_error("value", data, type);
          return;
        } else if (typeof type === "object") {
          if (type.hasOwnProperty('@extends'))
            sjot_extends(sjots, type, sjot);
          var isfinal = type.hasOwnProperty('@final') && type['@final'];
          var props = {};
          for (var prop in type) {
            if (prop.startsWith("@")) {
              var proptype = type[prop];
              switch (prop) {
                case "@one":
                  for (var propset of proptype)
                    if (propset.reduce( function (sum, prop) { return sum + data.hasOwnProperty(prop); }, 0) !== 1)
                      sjot_error("requires one of " + propset + " properties", data, "");
                  break;
                case "@any":
                  for (var propset of proptype)
                    if (!propset.some(function (prop) { return data.hasOwnProperty(prop); }))
                      sjot_error("requires any of " + propset + " properties", data, "");
                  break;
                case "@all":
                  for (var propset of proptype)
                    if (propset.some(function (prop) { return data.hasOwnProperty(prop); }) &&
                        !propset.every(function (prop) { return data.hasOwnProperty(prop); }))
                      sjot_error("requires all or none of " + propset + " properties", data, "");
                  break;
                case "@dep":
                  for (var name in proptype)
                    if (data.hasOwnProperty(name) &&
                        (typeof proptype[name] !== "string" || !data.hasOwnProperty(proptype[name])) &&
                        (!Array.isArray(proptype[name]) || !proptype[name].every(function (prop) { return data.hasOwnProperty(prop); })))
                      sjot_error("requires " + proptype[name], data, "");
                  break;
              }
            } else if (prop.startsWith("(")) {
              var proptype = type[prop];
              var matcher = RegExp("^" + prop + "$");
              for (var name in data) {
                if (data.hasOwnProperty(name) && matcher.test(name)) {
                  sjot_validate(sjots, data[name], proptype, sjot);
                  if (isfinal)
                    props[name] = null;
                }
              }
            } else {
              var i = prop.indexOf("?");
              if (i === -1) {
                if (!data.hasOwnProperty(prop))
                  sjot_error("should be present", data, "");
                sjot_validate(sjots, data[prop], type[prop], sjot);
                if (isfinal)
                  props[prop] = null;
              } else {
                var name = prop.slice(0, i);
                if (data.hasOwnProperty(name) && data[name] !== null && data[name] !== undefined) {
                  sjot_validate(sjots, data[name], type[prop], sjot);
                } else if (i < prop.length - 1) {
                  data[name] = sjot_default(prop.slice(i + 1), sjots, data, type[prop], sjot);
                  sjot_validate(sjots, data[name], type[prop], sjot);
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
                sjot_error("additional property should not be present", data, "");
        } else {
          sjot_error("value", data, type);
        }
      }
      return;
    case "boolean":
      if (type === "boolean" || type === "atom" || (data && type === "true") || (!data && type === "false"))
        return;
      sjot_error("value", data, type);
    case "number":
      switch (type) {
        case "atom":
        case "number":
        case "float":
        case "double":
          return;
        case "integer":
          if (!Number.isInteger(data))
            sjot_error("value", data, type);
          return;
        case "byte":
          if (data < -128 || data > 127 || !Number.isInteger(data))
            sjot_error("value", data, type);
          return;
        case "short":
          if (data < -32768 || data > 32767 || !Number.isInteger(data))
            sjot_error("value", data, type);
          return;
        case "int":
          if (data < -2147483648 || data > 2147483647 || !Number.isInteger(data))
            sjot_error("value", data, type);
          return;
        case "long":
          if (data < -140737488355328 || data > 140737488355327 || !Number.isInteger(data))
            sjot_error("value", data, type);
          return;
        case "ubyte":
          if (data < 0 || data > 255 || !Number.isInteger(data))
            sjot_error("value", data, type);
          return;
        case "ushort":
          if (data < 0 || data > 65535 || !Number.isInteger(data))
            sjot_error("value", data, type);
          return;
        case "uint":
          if (data < 0 || data > 4294967295 || !Number.isInteger(data))
            sjot_error("value", data, type);
          return;
        case "ulong":
          if (data < 0 || data > 18446744073709551615 || !Number.isInteger(data))
            sjot_error("value", data, type);
          return;
        default:
          if (typeof type !== "string")
            sjot_error("value", data, type);
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
              if (isfloat) {
                var p = type.indexOf(".", j + 2);
                if (p === -1 || p >= k)
                  break;
              }
              if (type.charCodeAt(k - 1) === 0x3E) {
                if (data < Number.parseFloat(type.slice(j + 2, k - 1)))
                  return;
              } else {
                if (data <= Number.parseFloat(type.slice(j + 2, k)))
                  return;
              }
            } else if (j < k && j !== -1) {
              if (isfloat) {
                var p = type.indexOf(".", i);
                if (p === -1 || p >= j)
                  break;
              }
              if (j + 2 === k) {
                var n = Number.parseFloat(type.slice(i, j));
                if (data > n || (!exclusive && data === n))
                  return;
              } else {
                if (isfloat) {
                  var p = type.indexOf(".", j + 2);
                  if (p === -1 || p >= k)
                    break;
                }
                var n = Number.parseFloat(type.slice(i, j));
                if (type.charCodeAt(k - 1) === 0x3E) {
                  if ((data > n || (!exclusive && data === n)) && data < Number.parseFloat(type.slice(j + 2, k - 1)))
                    return;
                } else {
                  if ((data > n || (!exclusive && data === n)) && data <= Number.parseFloat(type.slice(j + 2, k)))
                    return;
                }
              }
            } else {
              if (isfloat) {
                var p = type.indexOf(".", i);
                if (p === -1 || p >= k)
                  break;
              }
              if (data === Number.parseFloat(type.slice(i, k)))
                return;
            }
            i = k;
          }
      }
      sjot_error("value", data, type);
    case "string":
      if (type === "string" || type === "char[]" || type === "atom")
        return;
      if (typeof type !== "string")
        sjot_error("value", data, type);
      if (type.startsWith("(")) {
        if (RegExp("^" + type + "$").test(data))
          return;
      } else if (type.startsWith("char")) {
        if (type === "char") {
          if (data.length === 1)
            return;
        } else {
          return sjot_validate_bounds(data.length, type, 5);
        }
      } else {
        switch (type) {
          case "base64":
            if (/^[0-9A-Za-z+\/]*=?=?$/.test(data))
              return;
            break;
          case "hex":
            if (/^[0-9A-Fa-f]*$/.test(data))
              return;
            break;
          case "uuid":
            if (/^(urn:uuid:)?[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}$/.test(data))
              return;
            break;
          case "date":
            if (/^\d{4}-\d{2}-\d{2}$/.test(data))
              return;
            break;
          case "time":
            if (/^\d{2}:\d{2}:\d{2}(\.\d{1,6})?([-+]\d{2}:?\d{2}|Z)?$/.test(data))
              return;
            break;
          case "datetime":
            if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?([-+]\d{2}:?\d{2}|Z)?$/.test(data))
              return;
            break;
          case "duration":
            if (/^-?P(-?[0-9,.]*Y)?(-?[0-9,.]*M)?(-?[0-9,.]*W)?(-?[0-9,.]*D)?(T(-?[0-9,.]*H)?(-?[0-9,.]*M)?(-?[0-9,.]*S)?)?$/.test(data))
              return;
            break;
        }
      }
      sjot_error("value", data, type);
    default:
      sjot_schema_error("is not a valid type");
  }
}
function sjot_validate_union(sjots, data, type, sjot) {
  var union = [];
  for (var itemtype of type[0])
    sjot_check_union(sjots, itemtype, itemtype, sjot, union, 1);
  var n = 1;
  var item = data;
  while (Array.isArray(item)) {
    n++;
    if (item.length === 0) {
      if ((union[0] !== undefined && n >= union[0]) || union[n] !== undefined)
        return;
      sjot_error("value", data, type);
    }
    item = item[0];
  }
  if (union[0] !== undefined && n >= union[0])
    return;
  if (union[n] !== undefined) {
    if (item === null) {
      if (union[n].n === null)
        sjot_error("value", data, type);
      return sjot_validate(sjots, data, union[n].n, sjot);
    }
    switch (typeof item) {
      case "boolean":
        if (union[n].b !== null) {
          if (n > 1)
            return sjot_validate(sjots, data, union[n].b, sjot);
          for (var itemtype of type[0]) {
            try {
              return sjot_validate(sjots, data, itemtype, sjot);
            } catch (e) {
            }
          }
        }
        break;
      case "number":
        if (union[n].x !== null) {
          if (n > 1)
            return sjot_validate(sjots, data, union[n].x, sjot);
          for (var itemtype of type[0]) {
            try {
              return sjot_validate(sjots, data, itemtype, sjot);
            } catch (e) {
            }
          }
        }
        break;
      case "string":
        if (union[n].s !== null) {
          if (n > 1)
            return sjot_validate(sjots, data, union[n].s, sjot);
          for (var itemtype of type[0]) {
            try {
              return sjot_validate(sjots, data, itemtype, sjot);
            } catch (e) {
            }
          }
        }
        break;
      case "object":
        if (union[n].o !== null)
          return sjot_validate(sjots, data, union[n].o, sjot);
        if (union[n].p !== null) {
          for (var prop in item)
            if (union[n].p.hasOwnProperty(prop))
              return sjot_validate(sjots, data, union[n].p[prop], sjot);
          for (var prop in union[n].p)
            if (union[n].p.hasOwnProperty(prop))
              return sjot_validate(sjots, data, union[n].p[prop], sjot);
        }
    }
  }
  sjot_error("value", data, type);
}
function sjot_validate_bounds(len, type, i) {
  var j = type.indexOf("]", i);
  var k = type.indexOf(",", i);
  if (j === -1)
    j = type.indexOf("}", i);
  if (j === -1 || i === j)
    return;
  if (k === -1)
  {
    var n = Number.parseInt(type.slice(i, j));
    if (len !== n)
      sjot_error("length", len, type);
  } else if (k + 1 === j) {
    var n = Number.parseInt(type.slice(i, k));
    if (len < n)
      sjot_error("length", len, type);
  } else if (i === k) {
    var m = Number.parseInt(type.slice(k + 1, j));
    if (len > m)
      sjot_error("length", len, type);
  } else {
    var n = Number.parseInt(type.slice(i, k));
    var m = Number.parseInt(type.slice(k + 1, j));
    if (len < n || len > m)
      sjot_error("length", len, type);
  }
}
function sjot_extends(sjots, type, sjot) {
  if (type.hasOwnProperty('@extends')) {
    var basetype = type['@extends'];
    type['@extends'] = undefined;
    if (basetype === undefined)
      return;
    if (typeof basetype !== "string")
      sjot_schema_error("@extends does not refer to an object");
    var base = sjot_reftype(sjots, basetype, sjot);
    if (typeof base !== "object")
      sjot_schema_error("@extends does not refer to an object");
    sjot_extends(sjots, base, sjot);
    for (var prop in base) {
      if (base.hasOwnProperty(prop)) {
        if (prop.startsWith("@")) {
          switch (prop) {
            case "@final":
              if (base[prop])
                sjot_schema_error("@extends " + basetype + " that is final");
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
            sjot_schema_error("overriding of " + basetype + "/" + prop + " is not permitted");
          type[prop] = base[prop];
        }
      }
    }
  }
}
function sjot_roottype(sjot) {
  if (sjot.hasOwnProperty('@root')) {
    var type = sjot['@root'];
    if (typeof type !== "string" || !type.endsWith("#"))
      return type;
    sjot_schema_error("root refers to a root");
  }
  for (var prop in sjot)
    if (sjot.hasOwnProperty(prop) && !prop.startsWith("@"))
      return sjot[prop];
  sjot_schema_error("has no root type");
}
function sjot_reftype(sjots, type, sjot) {
  var h = type.indexOf("#");
  var prop = type.slice(h + 1);
  if (h <= 0) {
    if (prop === "")
      return sjot_roottype(sjot);
    if (!sjot.hasOwnProperty(prop))
      sjot_schema_error("missing named type referenced by " + prop);
    type = sjot[prop];
    if (typeof type === "string" && type.indexOf("#") !== -1 && !type.startsWith("(") && !(type.endsWith("]") || type.endsWith("}")))
      sjot_schema_error("spaghetti references to named types not permitted");
    return type;
  } else {
    for (var sjoot of sjots) {
      if (sjoot.hasOwnProperty('@id') && type.startsWith(sjoot['@id']) && sjoot['@id'].length === h) {
        if (prop === "")
          return sjot_roottype(sjoot);
        if (!sjoot.hasOwnProperty(prop))
          sjot_schema_error("schema " + sjoot['@id'] + " missing named type referenced by " + prop);
        type = sjoot[prop];
        if (typeof type === "string" && type.indexOf("#") !== -1 && !type.startsWith("(") && !(type.endsWith("]") || type.endsWith("}")))
          sjot_schema_error("spaghetti references to named types not permitted");
        return type;
      }
    }
    var URL = type.slice(0, h);
    try {
      var sjoot = sjot_load(URL);
      if (sjoot.hasOwnProperty('@id') && sjoot['@id'] !== URL)
        sjot_schema_error("schema \"" + URL + "\" load error due to @id URL mismatch");
      sjoot['@id'] = URL;
      sjots = sjots.concat(sjoot);
      return sjot_reftype(sjots, type, sjot);
    } catch (e) {
      sjot_schema_error("no type " + prop + " found in \"" + URL + "\" " + e);
    }
  }
}
function sjot_load(file) {
  var json;
  var load = function(file, callback) {
    var xobj = new XMLHttpRequest();
    xobj.overrideMimeType("application/json");
    xobj.open('GET', file, false); 
    xobj.onreadystatechange = function() {
      if (xobj.readyState == 4 && xobj.status == "200")
        callback(xobj.responseText);
    };
    xobj.send(null);
  }
  load(file, function(response) { json = JSON.parse(response); });
  return json;
}
function sjot_default(value, sjots, data, type, sjot) {
  if (typeof type !== "string" || type.endsWith("]") || type.endsWith("}"))
    return null;
  if (type.indexOf("#") !== -1 && !type.startsWith("("))
    type = sjot_reftype(sjots, type, sjot);
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
      if (!type.startsWith("(") && /\d/.test(type))
        return value === "null" ? 0 : Number.parseFloat(value);
      return value === "null" ? "" : value;
  }
}
function sjot_error(what, data, type) {
  var a = "is not an object ";
  if (type === "")
    a = "";
  else if (Array.isArray(type))
    a = type.length === 0 ? "is not an array " : type.length === 1 && Array.isArray(type[0]) ? "is not one of " : "is not an array of ";
  else if (typeof type === "string")
    a = type.endsWith("]") ? "is not an array " : type.endsWith("}") ? "is not a set " : "is not of type "
  else
    type = "";
  var b = "";
  if (typeof data === "string")
    throw  " " + what + " \"" + data + "\" " + a + type + b;
  else if (typeof data === "number" || typeof data === "boolean" || data === null)
    throw  " " + what + " " + data + " " + a + type + b;
  else
    throw  " " + what + " " + a + type + b;
}
function sjot_is_union(type) {
  return Array.isArray(type) &&
    type.length === 1 &&
    Array.isArray(type[0]) &&
    type[0].length > 1 &&
    typeof type[0] !== "number" &&
    typeof type[1] !== "number";
}
function sjot_check_union(sjots, type, itemtype, sjot, union, n) {
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
    itemtype = itemtype.slice(0, i);
    if (itemtype.indexOf("#") !== -1 && !itemtype.startsWith("("))
      return sjot_check_union(
          sjots,
          type,
          sjot_reftype(sjots, itemtype, sjot),
          sjot,
          union,
          n);
  }
  if (itemtype === "char" && n > 0) {
    n--;
    itemtype = "string";
  } else if (itemtype === "array") {
    n++;
    itemtype = "any";
  } else if (Array.isArray(itemtype)) {
    if (itemtype.length === 0 || itemtype === "array") {
      n++;
      itemtype = "any";
    } else if (itemtype.length === 1 || typeof itemtype[1] === "number") {
      if (sjot_is_union(itemtype))
        sjot_schema_error("nested unions are not permitted");
      n++;
      if (typeof itemtype[0] === "number")
        itemtype = "any";
      else
        return sjot_check_union(sjots, type, itemtype[0], sjot, union, n);
    } else if (typeof itemtype[0] === "number") {
      n++;
      if (typeof itemtype[1] === "number")
        itemtype = "any";
      else
        return sjot_check_union(sjots, type, itemtype[1], sjot, union, n);
    } else {
      n++;
      itemtype = "any";
    }
  }
  if (union[0] !== undefined && n >= union[0])
    sjot_schema_error("union requires distinct types");
  if (union[n] === undefined)
    union[n] = { n: null, b: null, x: null, s: null, o: null, p: null };
  if (typeof itemtype === "string") {
    switch (itemtype) {
      case "null":
        if (union[n].n !== null)
          sjot_schema_error("union has multiple null types");
        union[n].n = type;
        break;
      case "boolean":
      case "true":
      case "false":
        if (n > 1 && union[n].b !== null)
          sjot_schema_error("union has multiple boolean types");
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
          sjot_schema_error("union has multiple numeric types");
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
          sjot_schema_error("union has multiple string types");
        union[n].s = type;
        break;
      case "any":
        for (var i = n; i < union.length; i++)
          if (union[i] !== undefined && (union[i].n !== null || union[i].b !== null || union[i].x !== null || union[i].s !== null || union[i].o !== null || union[i].p !== null))
            sjot_schema_error("union requires distinct types");
        union[0] = n;
        break;
      case "atom":
        if (union[n].b !== null || union[n].x !== null || union[n].s !== null)
          sjot_schema_error("union has multiple atomic types");
        union[n].b = type;
        union[n].x = type;
        union[n].s = type;
        break;
      case "object":
        if (union[n].o !== null || union[n].p !== null)
          sjot_schema_error("union has multiple object types");
        union[n].o = type;
        break;
      default:
        if (itemtype.startsWith("(")) {
          if (n > 1 && union[n].s !== null)
            sjot_schema_error("union has multiple string array types");
          union[n].s = type;
        } else {
          if (n > 1 && union[n].x !== null)
            sjot_schema_error("union has multiple numeric array types");
          union[n].x = type;
        }
    }
  } else if (typeof itemtype === "object") {
    if (union[n].o !== null)
      sjot_schema_error("union requires distinct object types");
    if (union[n].p === null)
      union[n].p = {};
    for (var prop in itemtype) {
      if (!prop.startsWith('@') && itemtype.hasOwnProperty(prop)) {
        if (prop.startsWith("(")) {
          if (union[n].o !== null)
            sjot_schema_error("union requires distinct object types");
          union[n].o = type;
          break;
        } else {
          var i = prop.indexOf("?");
          if (i !== -1)
            prop = prop.slice(0, i);
          if (union[n].p.hasOwnProperty(prop))
            sjot_schema_error("union requires distinct object types");
          union[n].p[prop] = type;
        }
      }
    }
  }
}
function sjot_schema_error(msg) {
  throw "SJOT schema error: " + msg;
}
