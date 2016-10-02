/*!
 * sjot.js v0.0.2
 * by Robert van Engelen, engelen@genivia.com
 *
 * SJOT: Schemas for JSON Objects
 *
 * More info:
 * http://genivia.com/sjot.html
 *
 * Copyright (C) 2016, Robert van Engelen, Genivia Inc., All Rights Reserved
 * Released under the BSD3 license
 */

/* 
 * Usage:
 *
 * var obj = JSON.parse(text);
 *
 * if (SJOT.validate(obj))
 *   ... // obj validated against the embedded @sjot schema (if any)
 *
 * var sjot = '{ "sometype": { ... } }';
 *
 * if (SJOT.validate(obj, "#sometype", sjot))
 *   ... // obj validated against sjot schema type sometype
 *
 * if (SJOT.validate(obj, "http://example.com/sjot.json#sometype"))
 *   ... // obj validated against sjot schema type sometype from http://example.com/sjot.json
 *
 */

// TODO see inlined TODOs:
//
// - Implement @extends and @final
// - Implement external type references "URI#type"
// - Implement uniqueness check for sets
// - Improve error handling
// - Modularize and create npm

class SJOT {

  // validate(obj [, type [, schema ] ])
  static validate(obj, type, schema) {

    var sjot = schema;

    if (typeof schema === "string")
      sjot = JSON.parse(schema);

    if (type === undefined)
      type = "any";

    try {

      sjot_validate(sjot, obj, type);

    } catch (e) {

      console.log(e); // TODO FIXME error handling
      return false;

    }

    return true;

  }

}

// one validation function that is tail recursive
function sjot_validate(sjot, data, type) {

  if (type === "any") {

    if (data.hasOwnProperty('@sjot')) {

      // sjoot: validate this object using the embedded SJOT schema
      var sjoot = data['@sjot'];

      sjot_validate(sjoot, data, sjoot.hasOwnProperty('@root') ? sjoot['@root'] : sjoot[Object.keys(sjoot)[0]]);
      return;

    }

    return;
  }

  if (typeof type === "string") {

    var h = type.indexOf("#");

    if (h === 0) {

      // validate using the local type reference
      sjot_validate(sjot, data, sjot[type.slice(1)]);
      return;

    } else if (h !== -1) {

      if (sjot.hasOwnProperty('@id') && type.startsWith(sjot['@id']) && sjot['@id'].length === h) {

        // validate using the local type reference if URI matches the @id of this SJOT schema
        sjot_validate(sjot, data, type.slice(h + 1));
	return;

      } else {

        // TODO validate using the external URI type reference, load async

      }

      return;

    }

  }

  switch (typeof data) {

    case "object":

      if (data === null)
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
            sjot_validate(sjot, data[i], type[i]);
	  return;

	} else if (typeof type === "string") {

	  if (type.endsWith("]")) {

	    // validate an array
	    var i = type.lastIndexOf("[");
	    var itemtype = type.slice(0, i);

	    sjot_validate_bounds(data.length, type, i + 1);

	    for (var item of data)
	      sjot_validate(sjot, item, itemtype);
	    return;

	  } else if (type.endsWith("}")) {

	    // validate a set
	    var i = type.lastIndexOf("{");
	    var itemtype = type.slice(0, i);

	    // TODO check uniqueness of array items
	    sjot_validate_bounds(data.length, type, i + 1);

	    for (var item of data)
	      sjot_validate(sjot, item, itemtype);
	    return;

	  }

	}

	throw "array!=" + type;

      } else {

        // validate an object
        if (type === "object") {

          // validate this object using the embedded @sjot, if present
          sjot_validate(sjot, data, "any");
          return;

        }

        if (type === "date" || type === "time" || type === "datetime") {

          // special case for JS (not JSON), check for Date object
          if (!data.constructor.name != "Date")
            throw "data!=Date";
	  return;

        } else if (typeof type === "object") {

          // TODO extract @extend object properties and put into this type

          // check properties
          for (var prop in type) {

            if (prop.charCodeAt(0) === 0x40) {

              switch (prop) {

                case "@final":

                  if (type[prop]) {
                    // TODO check if no extra properties in data
                  }

                  break;

                case "@one":

                  for (var propset of type[prop]) {

                    if (propset.reduce((sum, prop) => sum + data.hasOwnProperty(prop), 0) !== 1)
                      throw "not one";

                  }

                  break;

                case "@any":

                  for (var propset of type[prop]) {

                    if (!propset.some(prop => data.hasOwnProperty(prop)))
                      throw "not any";

                  }

                  break;

                case "@all":

                  for (var propset of type[prop]) {

                    if (propset.some(prop => data.hasOwnProperty(prop)) &&
                        !propset.every(prop => data.hasOwnProperty(prop)))
                      throw "not all or none at all";

                  }

                  break;

              }

            } else {

              var i = -1;
              
              // search for ? while ignoring \\?
              do {

                i = prop.indexOf("?", i + 1);

              } while (i > 0 && prop.charCodeAt(i - 1) === 0x5C);

              if (i === -1) {

                // validate required property
                if (!data.hasOwnProperty(prop))
                  throw prop + " required";
                sjot_validate(sjot, data[prop], type[prop]);

              } else {

                var name = prop.slice(0, i);

                // validate optional property when present or set default value when absent
                if (data.hasOwnProperty(name)) {

                  sjot_validate(sjot, data[name], type[prop]);

                } else if (i < prop.length - 1) {

                  var value = prop.slice(i + 1);
                  var proptype = type[prop];

                  if (typeof proptype === "string") {

		    if (proptype.startsWith("#")) {

		      // TODO if proptype is a type reference, get its type from the schema

		    }

                    switch (proptype) {

                      case "boolean":

                        data[name] = (value === "true");
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

                        data[name] = Number.parseFloat(value);
                        break;

                      default:

                        data[name] = value;

                        // check proptype for numeric range and if so set number, not string
			if (!proptype.startsWith("(")) {

			  for (var i = 0; i < proptype.length; i++) {

			    if (proptype.charCodeAt(i) >= 0x30 && proptype.charCodeAt(i) <= 0x39) {

			      data[name] = Number.parseFloat(value);
			      break;

			    }

			  }

			}

                    }

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

      if (type.startsWith("char")) {

        if (type == "char") {

          if (data.length !== 1)
            throw "data!=char";

        } else {

          sjot_validate_bounds(data.length, type, 5);

        }

        return;

      } else if (type === "base64") {

        // TODO check base64
        return;

      } else if (type === "hex") {

        // TODO check hex
        return;

      } else if (type === "date") {

        // TODO check date
        return;

      } else if (type === "time") {

        // TODO check time
        return;

      } else if (type === "datetime") {

        // TODO check datetime
        return;

      } else if (type === "duration") {

        // TODO check duration
        return;

      } else if (type.charCodeAt(0) == 0x28) {

        // check regex
        if (RegExp("^" + type + "$").test(data))
          return;

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
