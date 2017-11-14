/**
 * Create SJOT schema from JSON data
 *
 * @module      snapsjot
 * @version     {VERSION}
 * @class       snapSJOT
 * @author      Robert van Engelen, engelen@genivia.com
 * @copyright   Robert van Engelen, Genivia Inc, 2016-2017. All Rights Reserved.
 * @license     BSD 3-Clause
 * @link        http://sjot.org
 */

"use strict";

var snapSJOT = (function () {

  var snapSJOT = {};

  snapSJOT.moduleProperty = 1;

  // returns SJOT schema created from JSON data that validates the JSON data
  snapSJOT.convert = function (data) {

    return {
      "@note": "SJOT schema created from JSON data by snapSJOT",
      "@root": snapsjot_convert(data)
    };

  };

  return snapSJOT;

}());

// returns SJOT schema created from JSON data
function snapsjot_convert(data) {

  if (typeof data === "object") {

    if (data === null || data === undefined)
      return "null";

    if (Array.isArray(data)) {

      var union = [];

      for (var i = 0; i < data.length; i++) {

        if (i === 0)
          union = [snapsjot_convert(data[0])];
        else
          /*union =*/ snapsjot_unify_union_types(union, [snapsjot_convert(data[i])]);

      }

      if (union.length <= 1)
        return union;
      return [[union]];

    }

    var type = { "@final": true };

    for (var prop in data) {

      if (data.hasOwnProperty(prop)) {

	if (prop === "@sjot")
	  type[prop] = [[{},[{}]]];
	else if (prop.indexOf("?") !== -1 ||
            prop.charCodeAt(0) === 0x28 /*(prop)*/ ||
            prop === "@root" ||
            prop === "@one" ||
            prop === "@any" ||
            prop === "@all" ||
            prop === "@dep" ||
            prop === "@final" ||
            prop === "@extends" ||
            prop === "@note")
          type[snapsjot_make_regex(prop)] = snapsjot_convert(data[prop]);
        else
          type[prop] = snapsjot_convert(data[prop]);

      }

    }

    return type;

  }

  return typeof data;

}

// returns regex of the given property name to escape special characters
function snapsjot_make_regex(prop) {

  return "(" + prop.
    replace(/\\/g, "\\\\").
    replace(/\./g, "\\.").
    replace(/\(/g, "\\(").
    replace(/\)/g, "\\)").
    replace(/\[/g, "\\(").
    replace(/\]/g, "\\)").
    replace(/\{/g, "\\(").
    replace(/\}/g, "\\)").
    replace(/\+/g, "\\+").
    replace(/\*/g, "\\+").
    replace(/\?/g, "\\?").
    replace(/\^/g, "\\^").
    replace(/\$/g, "\\$") + ")";

}

// returns true if the given two types are equal
function snapsjot_equal_types(type1, type2) {

  if (type1 === type2)
    return true;
  if (typeof type1 === "string" || typeof type2 === "string")
    return false;

  if (Array.isArray(type1) && type1.length === 1 && Array.isArray(type1[0])) {

    if (Array.isArray(type2) && type2.length === 1 && Array.isArray(type2[0])) {

      if (type1[0].length !== type2[0].length)
	return false;

      var n = 0;

      for (var i = 0; i < type1[0].length; i++)
	for (var j = 0; j < type2[0].length; j++)
	  if (snapsjot_equal_types(type1[0][i], type2[0][j]))
	    n++;
      if (n === type1[0].length)
	return true;

    }

  } else if (Array.isArray(type2) && type2.length === 1 && Array.isArray(type2[0])) {

    return false;

  } else if (Array.isArray(type1) && Array.isArray(type2)) {

      if (type1.length === type2.length)
	if (type1.length === 0 || snapsjot_equal_types(type1[0], type2[0]))
	  return true;

  } else if (typeof type1 === "object" && typeof type2 === "object") {

    for (var prop in type1)
      if (!type2.hasOwnProperty(prop))
	return false;
    for (var prop in type2)
      if (type1.hasOwnProperty(prop))
	return false;
    return true;

  }

  return false;

}

// returns type that unifies the given two types, type2 is destroyed
function snapsjot_unify_types(type1, type2) {

  if (snapsjot_equal_types(type1, type2))
    return type1;

  if (Array.isArray(type1) && type1.length === 1 && Array.isArray(type1[0])) {

    if (Array.isArray(type2) && type2.length === 1 && Array.isArray(type2[0]))
      return [snapsjot_unify_union_types(type1[0], type2[0])];
    return [snapsjot_unify_union_types(type1[0], [type2])];

  } else if (Array.isArray(type2) && type2.length === 1 && Array.isArray(type2[0])) {

    return [snapsjot_unify_union_types([type1], type2[0])];

  } else if (Array.isArray(type1)) {

    if (Array.isArray(type2)) {

      var union = snapsjot_unify_types(type1[0], type2[0]);

      if (Array.isArray(union) && union.length === 1 && Array.isArray(union[0])) {

        var arrays = [];

        for (var i = 0; i < union[0].length; i++)
          arrays.push([union[0][i]]);
        return [arrays];

      }

      return union;

    }

  } else if (typeof type1 === "object") {
    
    if (typeof type2 === "object")
      return snapsjot_unify_object_types(type1, type2);

  }

  return [[type1, type2]];

}

// returns union type that unifies the given two union types where unions are arrays of types, union1 and union2 are set to the result
function snapsjot_unify_union_types(union1, union2) {

  var redo = true;

  while (redo) {

    redo = false;

    for (var i = 0; !redo && i < union1.length; i++) {

      for (var j = 0; !redo && j < union2.length; j++) {

	var type = null;

	if (union2[j] !== null) {

	  if (snapsjot_equal_types(union1[i], union2[j])) {

	    union2[j] = null;

	  } else if (Array.isArray(union1[i]) && union1[i].length > 0 && Array.isArray(union2[j]) && union2[j].length === 0) {

	    union2[j] = null;

	  } else if (Array.isArray(union1[i]) && union1[i].length === 0 && Array.isArray(union2[j]) && union2[j].length > 0) {

	    union1[i] = union2[j];
	    union2[j] = null;

	  } else if (Array.isArray(union1[i]) && union1[i].length > 0 && Array.isArray(union2[j]) && union2[j].length > 0) {

	    type = snapsjot_unify_types(union1[i], union2[j]);
	    union2[j] = null;

	  } else if (typeof union1[i] === "object" && typeof union2[j] === "object") {

	    type = snapsjot_unify_object_types(union1[i], union2[j]);

	    if (!Array.isArray(type)) {

	      // must cascade object type unifications, redo outer loop
	      for (var k = i; k < union1.length - 1; k++)
		union1[k] = union1[k + 1];
	      union1.length = union1.length - 1;
	      union2[j] = type;
	      redo = true;

	    }

	    type = null;

	  }

	  if (type !== null) {

	    if (Array.isArray(type) && type.length === 1 && Array.isArray(type[0])) {

	      union1[i] = type[0][0];
	      for (var k = 1; k < type[0].length; k++)
		union1.push(type[0][k]);

	    } else {

	      union1[i] = type;

	    }

	  }

	}

      }

    }

  }

  for (var j = 0; j < union2.length; j++)
    if (union2[j] !== null)
      union1.push(union2[j]);
  for (var i = 0; i < union1.length; i++)
    union2[i] = union1[i];
  union2.length = union1.length;
  return union1;

}

// returns a type that unifies the given two object types, type2 is destroyed
function snapsjot_unify_object_types(type1, type2) {

  var type = { "@final": true };

  if (snapsjot_distinct_object_types(type1, type2))
    return [[type1, type2]];

  for (var prop in type1) {

    if (prop.charCodeAt(0) !== 0x40 /*@prop*/) {

      if (type2.hasOwnProperty(prop)) {

        type[prop] = snapsjot_unify_types(type1[prop], type2[prop]);
	type2[prop] = null;

      } else if (prop.charCodeAt(prop.length - 1) === 0x3F /*prop?*/) {

        var prop2 = prop.substring(0, prop.length - 1);

        if (type2.hasOwnProperty(prop2)) {

          type[prop] = snapsjot_unify_types(type1[prop], type2[prop2]);
	  type2[prop2] = null;

	} else {

	  type[prop] = type1[prop];

	}

      } else {

        var prop2 = prop + "?";

        if (type2.hasOwnProperty(prop2)) {

          type[prop2] = snapsjot_unify_types(type1[prop], type2[prop2]);
	  type2[prop2] = null;

	} else {

	  type[prop2] = type1[prop];

	}

      }

    }

  }

  for (var prop in type2) {

    if (type2.hasOwnProperty(prop) && type2[prop] !== null) {

      if (prop.charCodeAt(0) !== 0x40 /*@prop*/) {

	if (prop.charCodeAt(prop.length - 1) === 0x3F /*prop?*/)
	  type[prop] = type2[prop];
	else
	  type[prop + "?"] = type2[prop];

      }

    }

  }

  return type;

}

// returns true if the given two object types are distinct
function snapsjot_distinct_object_types(type1, type2) {

  var n = 0;

  for (var prop in type1) {

    if (type1.hasOwnProperty(prop) && prop.charCodeAt(0) !== 0x40 /*@prop*/) {

      if (prop.charCodeAt(prop.length - 1) === 0x3F /*prop?*/)
        prop = prop.substring(0, prop.length - 1);
      if (type2.hasOwnProperty(prop) || type2.hasOwnProperty(prop + "?"))
        return false;
      n++;

    }

  }

  if (n > 0)
    for (var prop in type2)
      if (type2.hasOwnProperty(prop) && prop.charCodeAt(0) !== 0x40 /*@prop*/)
	return true;
  return false;

}
