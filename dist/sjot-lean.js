/**
 * Schemas for JSON Objects, or simply SJOT, offers faster JSON validation with
 * lightweight schemas and compact validators.  SJOT schemas have the look and
 * feel of object templates and are easy to use.
 *
 * See README.md
 *
 * @module      sjot
 * @version     1.3.16
 * @class       SJOT
 * @author      Robert van Engelen, engelen@genivia.com
 * @copyright   Robert van Engelen, Genivia Inc, 2016-2017. All Rights Reserved.
 * @license     BSD 3-Clause
 * @link        http:
 */
"use strict";
var SJOT = (function () {
  var SJOT = {};
  SJOT.moduleProperty = 1;
  SJOT.valid = function (data, type, schema) {
    try {
      return this.validate(data, type, schema);
    } catch (e) {
      console.log(e);
      return false;
    }
  };
  SJOT.validate = function (data, type, schema) {
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
        sjot_schema_error("is not a SJOT schema object", typeof sjots);
    }
    if (Array.isArray(sjots) && sjots.length > 0)
      sjot_validate(sjots, data, type, sjots[0], "$", "/@root");
    else
      sjot_validate([sjots], data, type, sjots, "$", "/@root");
    return true;
  };
  SJOT.check = function (schema) {
    var sjots = schema;
    if (typeof schema === "string")
      sjots = JSON.parse(schema);
  };
  return SJOT;
}());
function sjot_validate(sjots, data, type, sjot, datapath, typepath) {
  if (type === "any") {
    if (typeof data === "object" && data !== null && data.hasOwnProperty('@sjot')) {
      var sjoot = data['@sjot'];
      if (Array.isArray(sjoot))
        return sjot_validate(sjots.concat(sjoot), data, sjot_roottype(sjoot[0]), sjoot[0], datapath, typepath + "{" + datapath + ".@sjot}");
      else if (typeof sjoot === "string" && sjoot !== "any" && sjoot !== "object")
        return sjot_validate(sjots, data, sjoot, sjot, datapath, typepath + "{" + datapath + ".@sjot}");
      else if (typeof sjoot === "object")
        return sjot_validate(sjots.concat([sjoot]), data, sjot_roottype(sjoot), sjoot, datapath, typepath + "{" + datapath + ".@sjot}");
      throw "Invalid @sjot schema " + datapath;
    }
    return;
  }
  if (typeof type === "string") {
    var h = type.indexOf("#");
    if (h >= 0 && type.charCodeAt(0) !== 0x28  && type.charCodeAt(type.length - 1) !== 0x5D  && type.charCodeAt(type.length - 1) !== 0x7D )
      return sjot_validate(
          sjots,
          data,
          sjot_reftype(sjots, type, sjot, typepath),
          sjot, datapath, typepath + "/" + type);
  }
  if (sjot_is_union(type))
    return sjot_validate_union(sjots, data, type, sjot, datapath, typepath);
  switch (typeof data) {
    case "object":
      if (data === null || data === undefined) {
        if (data === null && type === "null")
          return;
        sjot_error("value", data, type, datapath, typepath);
      } else if (Array.isArray(data)) {
        if (type === "array" || type === "any[]")
          return;
        if (Array.isArray(type)) {
          if (type.length === 0)
            return;
          if (type.length === 1) {
            if (typeof type[0] === "number") {
              if (data.length !== type[0])
                sjot_error("length", type[0], "any", datapath, typepath + "[" + type[0] + "]");
            } else {
              for (var i = 0; i < data.length; i++) {
                if (data[i] === null)
                  data[i] = sjot_default("null", sjots, null, type[0], sjot, datapath + "[" + i + "]", typepath + "[" + type[0] + "]");
                sjot_validate(sjots, data[i], type[0], sjot, datapath + "[" + i + "]", typepath + "[" + type[0] + "]");
              }
            }
          } else if (typeof type[1] === "number") {
            if (data.length > type[1])
              sjot_error("length", type[1], type[0], datapath, typepath + "[" + type[0] + "," + type[1] + "]");
            if (typeof type[0] === "number") {
              if (data.length < type[0])
                sjot_error("length", type[0], "any", datapath, typepath + "[" + type[0] + "," + type[1] + "]");
            } else {
              for (var i = 0; i < data.length; i++) {
                if (data[i] === null)
                  data[i] = sjot_default("null", sjots, null, type[0], sjot, datapath + "[" + i + "]", typepath + "[" + type[0] + "," + type[1] + "]");
                sjot_validate(sjots, data[i], type[0], sjot, datapath + "[" + i + "]", typepath + "[" + type[0] + "," + type[1] + "]");
              }
            }
          } else if (typeof type[0] === "number") {
            if (data.length < type[0])
              sjot_error("length", type[0], type[1], datapath, typepath + "[" + type[0] + "," + type[1] + "]");
            if (type.length > 2 && typeof type[2] === "number") {
              if (data.length > type[2])
                sjot_error("length", type[2], type[1], datapath, typepath + "[" + type[0] + "," + type[1] + "," + type[2] + "]");
            }
            for (var i = 0; i < data.length; i++) {
              if (data[i] === null)
                data[i] = sjot_default("null", sjots, null, type[1], sjot, datapath + "[" + i + "]", typepath + "[" + type[0] + "," + type[1] + "]");
              sjot_validate(sjots, data[i], type[1], sjot, datapath + "[" + i + "]", typepath + "[" + type[0] + "," + type[1] + "]");
            }
          } else if (type.length > 0) {
            if (data.length != type.length)
              sjot_error("array of length", data.length, type, datapath, typepath);
            for (var i = 0; i < data.length; i++) {
              if (data[i] === null)
                data[i] = sjot_default("null", sjots, null, type[i], sjot, datapath + "[" + i + "]", typepath + "[" + i + "]");
              sjot_validate(sjots, data[i], type[i], sjot, datapath + "[" + i + "]", typepath + "[" + i + "]");
            }
          }
          return;
        } else if (typeof type === "string") {
          if (type.charCodeAt(type.length - 1) === 0x5D ) {
            var i = type.lastIndexOf("[");
            var itemtype = type.slice(0, i);
            sjot_validate_bounds(data.length, type, i + 1, datapath, typepath);
            for (var j = 0; j < data.length; j++) {
              if (data[j] === null)
                data[j] = sjot_default("null", sjots, null, itemtype, sjot, datapath + "[" + j + "]", typepath);
              sjot_validate(sjots, data[j], itemtype, sjot, datapath + "[" + j + "]", typepath);
            }
            return;
          } else if (type.charCodeAt(type.length - 1) === 0x7D ) {
            var i = type.lastIndexOf("{");
            var itemtype = type.slice(0, i);
            if (itemtype.indexOf("#") !== -1 && itemtype.charCodeAt(0) !== 0x28  && itemtype.charCodeAt(itemtype.length - 1) !== 0x5D  && itemtype.charCodeAt(itemtype.length - 1) !== 0x7D ) {
              itemtype = sjot_reftype(sjots, itemtype, sjot, typepath);
              if (typeof itemtype !== "string")
                sjot_error("value", data, type, datapath, typepath);
            }
            var len = data.length;
            data = data.sort().filter(function (e, i, a) { return i === 0 || e !== a[i - 1]; });
            if (data.length !== len)
              sjot_error("value", data, type, datapath, typepath);
            sjot_validate_bounds(data.length, type, i + 1, datapath, typepath);
            for (var j = 0; j < data.length; j++) {
              if (data[j] === null)
                data[j] = sjot_default("null", sjots, null, itemtype, sjot, datapath + "[" + j + "]", typepath);
              sjot_validate(sjots, data[j], itemtype, sjot, datapath + "[" + j + "]", typepath);
            }
            return;
          }
        }
        sjot_error("value", data, type, datapath, typepath);
      } else {
        if (type === "object") {
          return sjot_validate(sjots, data, "any", sjot, datapath, typepath);
        }
        if (type === "date" || type === "time" || type === "datetime") {
          if (!data.constructor.name != "Date")
            sjot_error("value", data, type, datapath, typepath);
          return;
        } else if (typeof type === "object") {
          if (type.hasOwnProperty('@extends'))
            sjot_extends(sjots, type, sjot, typepath);
          var isfinal = type.hasOwnProperty('@final') && type['@final'];
          var props = {};
          for (var prop in type) {
            if (prop.charCodeAt(0) === 0x40 ) {
              var proptype = type[prop];
              switch (prop) {
                case "@one":
                  for (var i = 0; i < proptype.length; i++)
                    if (proptype[i].reduce(function (sum, prop) { return sum + data.hasOwnProperty(prop); }, 0) !== 1)
                      sjot_error("requires one of " + proptype[i] + " properties", data, "", datapath, typepath + "/@one");
                  break;
                case "@any":
                  for (var i = 0; i < proptype.length; i++)
                    if (!proptype[i].some(function (prop) { return data.hasOwnProperty(prop); }))
                      sjot_error("requires any of " + proptype[i] + " properties", data, "", datapath, typepath + "/@any");
                  break;
                case "@all":
                  for (var i = 0; i < proptype.length; i++)
                    if (proptype[i].some(function (prop) { return data.hasOwnProperty(prop); }) &&
                        !proptype[i].every(function (prop) { return data.hasOwnProperty(prop); }))
                      sjot_error("requires all or none of " + proptype[i] + " properties", data, "", datapath, typepath + "/@all");
                  break;
                case "@dep":
                  for (var name in proptype)
                    if (data.hasOwnProperty(name) &&
                        (typeof proptype[name] !== "string" || !data.hasOwnProperty(proptype[name])) &&
                        (!Array.isArray(proptype[name]) || !proptype[name].every(function (prop) { return data.hasOwnProperty(prop); })))
                      sjot_error("requires " + proptype[name], data, "", datapath + "." + name, typepath + "/@dep");
                  break;
              }
            } else if (prop.charCodeAt(0) === 0x28 ) {
              var proptype = type[prop];
              var matcher = RegExp("^" + prop + "$");
              for (var name in data) {
                if (data.hasOwnProperty(name) && matcher.test(name)) {
                  sjot_validate(sjots, data[name], proptype, sjot, datapath + "." + name, typepath + "/" + prop);
                  if (isfinal)
                    props[name] = null;
                }
              }
            } else {
              var i = prop.indexOf("?");
              if (i === -1) {
                if (!data.hasOwnProperty(prop))
                  sjot_error("should be present", data, "", datapath + "." + prop, typepath);
                sjot_validate(sjots, data[prop], type[prop], sjot, datapath + "." + prop, typepath + "/" + prop);
                if (isfinal)
                  props[prop] = null;
              } else {
                var name = prop.slice(0, i);
                if (data.hasOwnProperty(name) && data[name] !== null && data[name] !== undefined) {
                  sjot_validate(sjots, data[name], type[prop], sjot, datapath + "." + name, typepath + "/" + prop);
                } else if (i < prop.length - 1) {
                  data[name] = sjot_default(prop.slice(i + 1), sjots, data, type[prop], sjot, datapath + "." + name, typepath + "/" + prop);
                  sjot_validate(sjots, data[name], type[prop], sjot, datapath + "." + name, typepath + "/" + prop);
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
                sjot_error("additional property should not be present", data, "", datapath + "." + prop, typepath + "/@final");
        } else {
          sjot_error("value", data, type, datapath, typepath);
        }
      }
      return;
    case "boolean":
      if (type === "boolean" || type === "atom" || (data && type === "true") || (!data && type === "false"))
        return;
      sjot_error("value", data, type, datapath, typepath);
    case "number":
      var isfloat = Math.floor(data) !== data;
      switch (type) {
        case "atom":
        case "number":
        case "float":
        case "double":
          return;
        case "integer":
          if (isfloat)
            sjot_error("value", data, type, datapath, typepath);
          return;
        case "byte":
          if (data < -128 || data > 127 || isfloat)
            sjot_error("value", data, type, datapath, typepath);
          return;
        case "short":
          if (data < -32768 || data > 32767 || isfloat)
            sjot_error("value", data, type, datapath, typepath);
          return;
        case "int":
          if (data < -2147483648 || data > 2147483647 || isfloat)
            sjot_error("value", data, type, datapath, typepath);
          return;
        case "long":
          if (data < -140737488355328 || data > 140737488355327 || isfloat)
            sjot_error("value", data, type, datapath, typepath);
          return;
        case "ubyte":
          if (data < 0 || data > 255 || isfloat)
            sjot_error("value", data, type, datapath, typepath);
          return;
        case "ushort":
          if (data < 0 || data > 65535 || isfloat)
            sjot_error("value", data, type, datapath, typepath);
          return;
        case "uint":
          if (data < 0 || data > 4294967295 || isfloat)
            sjot_error("value", data, type, datapath, typepath);
          return;
        case "ulong":
          if (data < 0 || data > 18446744073709551615 || isfloat)
            sjot_error("value", data, type, datapath, typepath);
          return;
        default:
          if (typeof type !== "string")
            sjot_error("value", data, type, datapath, typepath);
          for (var i = 0; i < type.length; i++) {
            var exclusive = false;
            if (type.charCodeAt(i) === 0x3C ) {
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
              if (type.charCodeAt(k - 1) === 0x3E ) {
                if (data < parseFloat(type.slice(j + 2, k - 1)))
                  return;
              } else {
                if (data <= parseFloat(type.slice(j + 2, k)))
                  return;
              }
            } else if (j < k && j !== -1) {
              if (isfloat) {
                var p = type.indexOf(".", i);
                if (p === -1 || p >= j)
                  break;
              }
              if (j + 2 === k) {
                var n = parseFloat(type.slice(i, j));
                if (data > n || (!exclusive && data === n))
                  return;
              } else {
                if (isfloat) {
                  var p = type.indexOf(".", j + 2);
                  if (p === -1 || p >= k)
                    break;
                }
                var n = parseFloat(type.slice(i, j));
                if (type.charCodeAt(k - 1) === 0x3E ) {
                  if ((data > n || (!exclusive && data === n)) && data < parseFloat(type.slice(j + 2, k - 1)))
                    return;
                } else {
                  if ((data > n || (!exclusive && data === n)) && data <= parseFloat(type.slice(j + 2, k)))
                    return;
                }
              }
            } else {
              if (isfloat) {
                var p = type.indexOf(".", i);
                if (p === -1 || p >= k)
                  break;
              }
              if (data === parseFloat(type.slice(i, k)))
                return;
            }
            i = k;
          }
      }
      sjot_error("value", data, type, datapath, typepath);
    case "string":
      if (type === "string" || type === "char[]" || type === "atom")
        return;
      if (typeof type !== "string")
        sjot_error("value", data, type, datapath, typepath);
      if (type.charCodeAt(0) === 0x28 ) {
        if (RegExp("^" + type + "$").test(data))
          return;
      } else if (type.slice(0, 4) === "char") {
        if (type === "char") {
          if (data.length === 1)
            return;
        } else {
          return sjot_validate_bounds(data.length, type, 5, datapath, typepath);
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
      sjot_error("value", data, type, datapath, typepath);
    default:
      sjot_schema_error("is not a valid type", typepath + "/" + type);
  }
}
function sjot_validate_union(sjots, data, type, sjot, datapath, typepath) {
  var union = [];
  for (var i = 0; i < type[0].length; i++)
    sjot_check_union(sjots, type[0][i], type[0][i], sjot, typepath + "/" + type[0][i], union, 1);
  var n = 1;
  var item = data;
  while (Array.isArray(item)) {
    n++;
    if (item.length === 0) {
      if ((union[0] !== undefined && n >= union[0]) || union[n] !== undefined)
        return;
      sjot_error("value", data, type, datapath, typepath);
    }
    item = item[0];
  }
  if (union[0] !== undefined && n >= union[0])
    return;
  if (union[n] !== undefined) {
    if (item === null) {
      if (union[n].n === null)
        sjot_error("value", data, type, datapath, typepath);
      return sjot_validate(sjots, data, union[n].n, sjot, typepath + "/" + union[n].n);
    }
    switch (typeof item) {
      case "boolean":
        if (union[n].b !== null) {
          if (n > 1)
            return sjot_validate(sjots, data, union[n].b, sjot, typepath + "/" + union[n].b);
          for (var i = 0; i < type[0].length; i++) {
            try {
              return sjot_validate(sjots, data, type[0][i], sjot, typepath + "/" + type[0][i]);
            } catch (e) {
            }
          }
        }
        break;
      case "number":
        if (union[n].x !== null) {
          if (n > 1)
            return sjot_validate(sjots, data, union[n].x, sjot, typepath + "/" + union[n].x);
          for (var i = 0; i < type[0].length; i++) {
            try {
              return sjot_validate(sjots, data, type[0][i], sjot, typepath + "/" + type[0][i]);
            } catch (e) {
            }
          }
        }
        break;
      case "string":
        if (union[n].s !== null) {
          if (n > 1)
            return sjot_validate(sjots, data, union[n].s, sjot, typepath + "/" + union[n].s);
          for (var i = 0; i < type[0].length; i++) {
            try {
              return sjot_validate(sjots, data, type[0][i], sjot, typepath + "/" + type[0][1]);
            } catch (e) {
            }
          }
        }
        break;
      case "object":
        if (union[n].o !== null)
          return sjot_validate(sjots, data, union[n].o, sjot, typepath + "/" + union[n].o);
        if (union[n].p !== null) {
          for (var prop in item)
            if (union[n].p.hasOwnProperty(prop))
              return sjot_validate(sjots, data, union[n].p[prop], sjot, typepath + "/" + union[n].p[prop]);
          for (var prop in union[n].p)
            if (union[n].p.hasOwnProperty(prop))
              return sjot_validate(sjots, data, union[n].p[prop], sjot, typepath + "/" + union[n].p[prop]);
        }
    }
  }
  sjot_error("value", data, type, datapath, typepath);
}
function sjot_validate_bounds(len, type, i, datapath, typepath) {
  var j = type.indexOf("]", i);
  var k = type.indexOf(",", i);
  if (j === -1)
    j = type.indexOf("}", i);
  if (j === -1 || i === j)
    return;
  if (k === -1)
  {
    var n = parseInt(type.slice(i, j), 10);
    if (len !== n)
      sjot_error("length", len, type, datapath, typepath);
  } else if (k + 1 === j) {
    var n = parseInt(type.slice(i, k), 10);
    if (len < n)
      sjot_error("length", len, type, datapath, typepath);
  } else if (i === k) {
    var m = parseInt(type.slice(k + 1, j), 10);
    if (len > m)
      sjot_error("length", len, type, datapath, typepath);
  } else {
    var n = parseInt(type.slice(i, k), 10);
    var m = parseInt(type.slice(k + 1, j), 10);
    if (len < n || len > m)
      sjot_error("length", len, type, datapath, typepath);
  }
}
function sjot_extends(sjots, type, sjot, typepath) {
  if (type.hasOwnProperty('@extends')) {
    var basetype = type['@extends'];
    type['@extends'] = undefined;
    if (basetype === undefined)
      return;
    if (typeof basetype !== "string")
      sjot_schema_error("@extends does not refer to an object", typepath);
    var base = sjot_reftype(sjots, basetype, sjot, typepath);
    if (typeof base !== "object")
      sjot_schema_error("@extends does not refer to an object", typepath);
    sjot_extends(sjots, base, sjot, typepath);
    for (var prop in base) {
      if (base.hasOwnProperty(prop)) {
        if (prop.charCodeAt(0) === 0x40 ) {
          switch (prop) {
            case "@final":
              if (base[prop])
                sjot_schema_error("@extends " + basetype + " that is final", typepath);
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
            sjot_schema_error("overriding of " + basetype + "/" + prop + " is not permitted", typepath + "/" + prop);
          type[prop] = base[prop];
        }
      }
    }
  }
}
function sjot_roottype(sjot) {
  if (sjot.hasOwnProperty('@root')) {
    var type = sjot['@root'];
    if (typeof type !== "string" || type.charCodeAt(type.length - 1) !== 0x23  )
      return type;
    sjot_schema_error("root refers to a root", "schema");
  }
  var root = null;
  for (var prop in sjot)
  {
    if (prop.charCodeAt(0) !== 0x40  && sjot.hasOwnProperty(prop))
    {
      if (root !== null)
        sjot_schema_error("has no unique root " + root + ", also found " + prop, "schema");
      root = prop;
    }
  }
  if (root !== null)
    return sjot[root];
  sjot_schema_error("has no @root", "schema");
}
function sjot_reftype(sjots, type, sjot, typepath) {
  var h = type.indexOf("#");
  var prop = type.slice(h + 1);
  if (h <= 0) {
    if (prop === "")
      return sjot_roottype(sjot);
    if (!sjot.hasOwnProperty(prop))
      sjot_schema_error("missing named type referenced by " + prop, typepath + "/" + type);
    type = sjot[prop];
    if (typeof type === "string" && type.indexOf("#") !== -1 && type.charCodeAt(0) !== 0x28  && type.charCodeAt(type.length - 1) !== 0x5D  && type.charCodeAt(type.length - 1) !== 0x7D )
      sjot_schema_error("spaghetti references to named types not permitted", typepath + "/" + type);
    return type;
  } else {
    for (var i = 0; i < sjots.length; i++) {
      if (sjots[i].hasOwnProperty('@id') && sjots[i]['@id'].length === h && type.slice(0, h) === sjots[i]['@id']) {
        if (prop === "")
          return sjot_roottype(sjots[i]);
        if (!sjots[i].hasOwnProperty(prop))
          sjot_schema_error("schema " + sjots[i]['@id'] + " missing named type referenced by " + prop, typepath + "/" + type);
        type = sjots[i][prop];
        if (typeof type === "string" && type.indexOf("#") !== -1 && type.charCodeAt(0) !== 0x28  && type.charCodeAt(type.length - 1) !== 0x5D  && type.charCodeAt(type.length - 1) !== 0x7D )
          sjot_schema_error("spaghetti references to named types not permitted", typepath + "/" + type);
        return type;
      }
    }
    var URL = type.slice(0, h);
    try {
      var sjoot = sjot_load(URL);
      if (sjoot.hasOwnProperty('@id') && sjoot['@id'] !== URL)
        sjot_schema_error("schema \"" + URL + "\" load error due to @id URL mismatch", typepath + "/" + type);
      sjoot['@id'] = URL;
      sjots = sjots.concat(sjoot);
      return sjot_reftype(sjots, type, sjot, typepath);
    } catch (e) {
      sjot_schema_error("no type " + prop + " found in \"" + URL + "\" " + e, typepath + "/" + type);
    }
  }
}
function sjot_load(file) {
  var json;
  var load = function (file, callback) {
    var xobj = new XMLHttpRequest();
    xobj.overrideMimeType("application/json");
    xobj.open('GET', file, false); 
    xobj.onreadystatechange = function () {
      if (xobj.readyState == 4 && xobj.status == "200")
        callback(xobj.responseText);
    };
    xobj.send(null);
  }
  load(file, function (response) { json = JSON.parse(response); });
  return json;
}
function sjot_default(value, sjots, data, type, sjot, datapath, typepath) {
  if (typeof type !== "string" || type.charCodeAt(type.length - 1) === 0x5D  || type.charCodeAt(type.length - 1) === 0x7D )
    return null;
  if (type.indexOf("#") !== -1 && type.charCodeAt(0) !== 0x28 )
    type = sjot_reftype(sjots, type, sjot, typepath);
  if (typeof type !== "string" || type.charCodeAt(type.length - 1) === 0x5D  || type.charCodeAt(type.length - 1) === 0x7D )
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
      return value === "null" ? 0 : parseFloat(value);
    case "object":
    case "array":
      return null;
    default:
      if (type.charCodeAt(0) !== 0x28  && /\d/.test(type))
        return value === "null" ? 0 : parseFloat(value);
      return value === "null" ? "" : value;
  }
}
function sjot_error(what, data, type, datapath, typepath) {
  var a = "is not an object ";
  if (type === "")
    a = "";
  else if (Array.isArray(type))
    a = type.length === 0 ? "is not an array " : type.length === 1 && Array.isArray(type[0]) ? "is not one of " : "is not an array of ";
  else if (typeof type === "string")
    a = type.charCodeAt(type.length - 1) === 0x5D  ? "is not an array " : type.charCodeAt(type.length - 1) === 0x7D  ? "is not a set " : "is not of type "
  else
    type = "";
  var b = typepath !== "" ? (type === "" ? "as required by " : " required by ") + typepath : "";
  if (typeof data === "string")
    throw datapath + " " + what + " \"" + data + "\" " + a + type + b;
  else if (typeof data === "number" || typeof data === "boolean" || data === null)
    throw datapath + " " + what + " " + data + " " + a + type + b;
  else
    throw datapath + " " + what + " " + a + type + b;
}
function sjot_is_union(type) {
  return Array.isArray(type) &&
    type.length === 1 &&
    Array.isArray(type[0]) &&
    type[0].length > 1 &&
    typeof type[0] !== "number" &&
    typeof type[1] !== "number";
}
function sjot_check_union(sjots, type, itemtype, sjot, typepath, union, n) {
  if (typeof itemtype === "string") {
    var i = itemtype.length;
    while (i > 0) {
      if (itemtype.charCodeAt(i - 1) === 0x5D )
        i = itemtype.lastIndexOf("[", i - 1);
      else if (type.charCodeAt(i - 1) === 0x7D )
        i = itemtype.lastIndexOf("{", i - 1);
      else
        break;
      n++;
    }
    itemtype = itemtype.slice(0, i);
    if (itemtype.indexOf("#") !== -1 && itemtype.charCodeAt(0) !== 0x28 )
      return sjot_check_union(
          sjots,
          type,
          sjot_reftype(sjots, itemtype, sjot, typepath),
          sjot,
          typepath,
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
        sjot_schema_error("nested unions are not permitted", typepath);
      n++;
      if (typeof itemtype[0] === "number")
        itemtype = "any";
      else
        return sjot_check_union(sjots, type, itemtype[0], sjot, typepath, union, n);
    } else if (typeof itemtype[0] === "number") {
      n++;
      if (typeof itemtype[1] === "number")
        itemtype = "any";
      else
        return sjot_check_union(sjots, type, itemtype[1], sjot, typepath, union, n);
    } else {
      n++;
      itemtype = "any";
    }
  }
  if (union[0] !== undefined && n >= union[0])
    sjot_schema_error("union requires distinct types", typepath);
  if (union[n] === undefined)
    union[n] = { n: null, b: null, x: null, s: null, o: null, p: null };
  if (typeof itemtype === "string") {
    switch (itemtype) {
      case "null":
        if (union[n].n !== null)
          sjot_schema_error("union has multiple null types", typepath);
        union[n].n = type;
        break;
      case "boolean":
      case "true":
      case "false":
        if (n > 1 && union[n].b !== null)
          sjot_schema_error("union has multiple boolean types", typepath);
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
          sjot_schema_error("union has multiple numeric types", typepath);
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
          sjot_schema_error("union has multiple string types", typepath);
        union[n].s = type;
        break;
      case "any":
        for (var i = n; i < union.length; i++)
          if (union[i] !== undefined && (union[i].n !== null || union[i].b !== null || union[i].x !== null || union[i].s !== null || union[i].o !== null || union[i].p !== null))
            sjot_schema_error("union requires distinct types", typepath);
        union[0] = n;
        break;
      case "atom":
        if (union[n].b !== null || union[n].x !== null || union[n].s !== null)
          sjot_schema_error("union has multiple atomic types", typepath);
        union[n].b = type;
        union[n].x = type;
        union[n].s = type;
        break;
      case "object":
        if (union[n].o !== null || union[n].p !== null)
          sjot_schema_error("union has multiple object types", typepath);
        union[n].o = type;
        break;
      default:
        if (itemtype.charCodeAt(0) === 0x28 ) {
          if (n > 1 && union[n].s !== null)
            sjot_schema_error("union has multiple string array types", typepath);
          union[n].s = type;
        } else {
          if (n > 1 && union[n].x !== null)
            sjot_schema_error("union has multiple numeric array types", typepath);
          union[n].x = type;
        }
    }
  } else if (typeof itemtype === "object") {
    if (union[n].o !== null)
      sjot_schema_error("union requires distinct object types", typepath);
    if (union[n].p === null)
      union[n].p = {};
    for (var prop in itemtype) {
      if (prop.charCodeAt(0) !== 0x40  && itemtype.hasOwnProperty(prop)) {
        if (prop.charCodeAt(0) === 0x28 ) {
          if (union[n].o !== null)
            sjot_schema_error("union requires distinct object types", typepath);
          union[n].o = type;
          break;
        } else {
          var i = prop.indexOf("?");
          if (i !== -1)
            prop = prop.slice(0, i);
          if (union[n].p.hasOwnProperty(prop))
            sjot_schema_error("union requires distinct object types", typepath);
          union[n].p[prop] = type;
        }
      }
    }
  }
}
function sjot_schema_error(msg, typepath) {
  throw "SJOT schema error: " + typepath + " " + msg;
}
