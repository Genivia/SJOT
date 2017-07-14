/**
 * Convert JSON Schema v3 and v4 to SJOT
 *
 * @module      js2sjot
 * @version     {VERSION}
 * @class       JS2SJOT
 * @requires    sjot.js
 * @author      Chris Moutsos, ckm13d@my.fsu.edu
 * @copyright   Robert van Engelen, Genivia Inc, 2016. All Rights Reserved.
 * @license     BSD3
 * @link        http://sjot.org
 */

 /*
    Requires sjot.js SJOT class

    Usage

 var SJOT = require("sjot");     // npm sjot package for node.js

 var JSONSchema = {
  "$schema": "http://json-schema.org/draft-04/schema#",
  "description": "A person info object with optional id (default 999), name, street, and optional phone number",
  "type": "object",
  "properties": {
    "id": {
      "minimum": 0,
      "maximum": 999,
      "type": "integer",
      "default": 999
    },
    "name": {
      "type": "string"
    },
    "street": {
      "type": "string"
    },
    "phone": {
      "type": "string",
      "pattern": "^[- 0-9]+$"
    }
  },
  "required": [
    "name",
    "street"
  ]
 };

 var SJOTSchema = JS2SJOT.toSJOT(JSONSchema);

 */

"use strict";

class JS2SJOT {
  static toSJOT(schema, version) {
    var js = schema;
    if (typeof js === "string") {
      js = JSON.parse(js);
    }
    if (Array.isArray(js)) {
      var schemas = [];
      for (var i = 0; i < js.length; i++) {
        schemas.push(js_2sjot(js[i], version));
      }
      return schemas;
    }
    else {
      return js_2sjot(js, version);
    }
  }
}

var js_2sjot = function(js, version) {
  var sjot = {};

  toSJOT(js, js, "@root", sjot, sjot, false);

  if (js.hasOwnProperty("definitions")) {
    for (var defProp in js["definitions"]) {
      if (js["definitions"].hasOwnProperty(defProp)) {
        toSJOT(js, js["definitions"][defProp],
               defProp,
               sjot, sjot,
               false);
      }
    }
  }

  return sjot;
};

var getSJOTTypeFromReference = function(ref) {
  var h = ref.indexOf("#");
  if (h === -1) {
    /* TODO: no # */
    return ref;
  }
  else if (h === 0) {
    /* local reference #/definitions/... */
    return "#" + ref.substring("#/definitions/".length);
  }
  else {
    /* TODO: reference URI#... */
    return ref;
  }
};

var toSJOT = function(jsRoot, jsNode, jPropName, sjotRoot, sjotNode, optional) {
  var typeName = getSJOTTypeFromNode(jsRoot, jsNode, jPropName, sjotRoot);

  if (sjotNode !== undefined) {
    var opt = (optional === undefined) ? true : optional;
    var propName = getSJOTPropertyFromNode(jsRoot, jsNode, jPropName, opt);
    sjotNode[propName] = typeName;
  }

  return typeName;
};

var getSJOTPropertyFromNode = function(jsRoot, jsNode, jPropName, optional) {
  var s = jPropName;
  if (optional) {
    var node;
    if (jsNode.hasOwnProperty("$ref")) {
      /* get the ref leaf for it's default value */
      /* FIXME: do we want to grab the first default value we see? */
      node = resolveJSONPointer(jsRoot, jsRoot, jsNode["$ref"]);
    }
    else {
      node = jsNode;
      if (jsNode["type"] === "array" &&
          !Array.isArray(jsNode["items"]) &&
          jsNode["items"].hasOwnProperty("type")) {
        return getSJOTPropertyFromNode(jsRoot, jsNode["items"],
                                       jPropName,
                                       optional);
      }
    }
    s += "?";
    if (node.hasOwnProperty("default")) {
      var def = node["default"];
      if (def === "") {
        def = "null";
      }
      s += def;
    }
  }
  return s;
};

var resolveJSONPointer = function(jsRoot, jsNode, ptr) {
  if (ptr.startsWith('http://')) { /* FIXME: sloppy */
    return jsNode;
  }
  var endIndex = ptr.indexOf('/');
  var nextProp;
  if (endIndex === -1) {
    nextProp = ptr;
    ptr = "";
  }
  else {
    nextProp = ptr.substring(0, endIndex);
    ptr = ptr.substring(endIndex+1);
  }
  if (nextProp === "#") {
    return resolveJSONPointer(jsRoot, jsRoot, ptr);
  }
  if (nextProp.length) {
    return resolveJSONPointer(jsRoot, jsNode[nextProp], ptr);
  }
  if (jsNode.hasOwnProperty("$ref")) {
    return resolveJSONPointer(jsRoot, jsRoot, jsNode["$ref"]);
  }
  return jsNode;
};

var getSJOTTypeFromNode = function(jsRoot, jsNode, jPropName, sjotRoot)  {
  /* change extends to allOf (V3 -> V4) */
  if (jsNode.hasOwnProperty("extends")) {
    var extendsCopy = JSON.parse(JSON.stringify(jsNode["extends"]));
    delete jsNode["extends"];
    var nodeCopy = JSON.parse(JSON.stringify(jsNode));

    var newNode = {};
    newNode["allOf"] = [];
    newNode["allOf"].push(nodeCopy);
    newNode["allOf"].push(extendsCopy);
    jsNode = newNode;
  }

  /* renaming "additionalProperties" */
  if (jPropName === "(.*)") {
    jPropName = "addProps";
  }

  /* enum types */
  if (jsNode.hasOwnProperty("enum")) {
    return getSJOTEnumTypeFromNode(jsRoot, jsNode, jPropName, sjotRoot);
  }

  /* get the reference type */
  if (jsNode.hasOwnProperty("$ref")) {
    return getSJOTTypeFromReference(jsNode["$ref"]);
  }

  /* no specified type */
  if (!jsNode.hasOwnProperty("type")) {
    if (jsNode.hasOwnProperty("properties") ||
        jsNode.hasOwnProperty("minProperties") ||
        jsNode.hasOwnProperty("maxProperties") ||
        jsNode.hasOwnProperty("required") ||
        jsNode.hasOwnProperty("additionalProperties") ||
        jsNode.hasOwnProperty("patternProperties") ||
        jsNode.hasOwnProperty("dependencies")) {
      jsNode["type"] = "object";
    }
    else if (jsNode.hasOwnProperty("items") ||
             jsNode.hasOwnProperty("minItems") ||
             jsNode.hasOwnProperty("maxItems") ||
             jsNode.hasOwnProperty("uniqueItems")) {
      jsNode["type"] = "array";
    }
    else if (jsNode.hasOwnProperty("minLength") ||
             jsNode.hasOwnProperty("maxLength") ||
             jsNode.hasOwnProperty("pattern")) {
      jsNode["type"] = "string";
    }
    else if (jsNode.hasOwnProperty("multipleOf") ||
             jsNode.hasOwnProperty("divisibleBy") ||
             jsNode.hasOwnProperty("minimum") ||
             jsNode.hasOwnProperty("maximum") ||
             jsNode.hasOwnProperty("exclusiveMinimum") ||
             jsNode.hasOwnProperty("exclusiveMaximum")) {
      jsNode["type"] = "number";
    }
    else {
      return "any";
    }
  }

  /* normal type case */
  var s;
  if (typeof(jsNode["type"]) === "string") {
    /* single type */
    switch(jsNode["type"]) {
      case "object":
        s = getSJOTObjectTypeFromNode(jsRoot, jsNode, jPropName, sjotRoot);
      break;
      case "array":
        s = getSJOTArrayTypeFromNode(jsRoot, jsNode, jPropName, sjotRoot);
      break;
      case "number":
        s = getSJOTNumberTypeFromNode(jsNode, false);
        break;
      case "integer":
        s = getSJOTNumberTypeFromNode(jsNode, true);
      break;
      case "string":
        s = getSJOTStringTypeFromNode(jsNode, sjotRoot);
      break;
      default:
        s = jsNode["type"];
    }
  }
  else {
    /* array of types -> SJOT union of types */
    var types = [];
    for (var ti = 0; ti < jsNode["type"].length; ti++) {
      var node;
      if (typeof(jsNode["type"][ti]) === "string") {
        node = { "type": jsNode["type"][ti] };
      }
      else {
        node = jsNode["type"][ti];
      }
      types.push(getSJOTTypeFromNode(jsRoot, node,
                                     jPropName,
                                     sjotRoot));
    }
    s = [ types ];
  }

  return s;
};

var getSJOTEnumTypeFromNode = function(jsRoot, jsNode, jPropName, sjotRoot) {
  var enums = jsNode["enum"];

  /* remove default value not in the enum */
  if (jsNode.hasOwnProperty("default")) {
    if (enums.indexOf(jsNode["default"]) === -1) {
      delete jsNode["default"];
    }
  }

  /* filter out enums that aren't in "type" */
  if (jsNode.hasOwnProperty("type")) {
    var types = jsNode["type"];
    if (typeof(types) === "string") {
      types = [ types ];
    }
    enums = enums.filter(function(v, i, a) {
      var eType;
      if (Array.isArray(v)) {
        eType = "array";
      }
      else if (v === null) {
        eType = "null";
      }
      else {
        eType = typeof(v);
      }

      if (eType === "number" && v.toString().indexOf(".") === -1) {
        return (types.indexOf("integer") !== -1 ||
                types.indexOf("number") !== -1);
      }

      return (types.indexOf(eType) !== -1);
    });
  }

  /* create SJOT union */
  var sjotEnumTypes = [];
  if (jPropName === "@root") {
    jPropName = "root";
  }
  for (var i = 0; i < enums.length; i++) {
    var t = getSJOTTypeFromLiteralObject(jsRoot, enums[i],
                                         jPropName + "_enum_type",
                                         sjotRoot);
    sjotEnumTypes.push(t);
  }

  return [ sjotEnumTypes ];
};

var getSJOTTypeFromLiteralObject = function(jsRoot, object, jPropName, sjotRoot) {
  if (object === null) {
    return "null";
  }

  if (Array.isArray(object)) {
    var types = [];
    for (var i = 0; i < object.length; i++) {
      types.push(getSJOTTypeFromLiteralObject(jsRoot, object[i],
                                              jPropName,
                                              sjotRoot));
    }
    return [ types ];
  }

  switch (typeof(object)) {
    case "boolean":
      return object ? "true" : "false";
    case "string":
      return getSJOTRegexType(object, true);
    case "number":
      /* falls through */
    case "integer":
      return object.toString();
    case "object":
      if (!Object.keys(object).length) {
        return {};
      }

      /* make a reference */
      var obj = {};

      /* recursively convert literal property values to SJOT types */
      for (var objProp in object) {
        if (object.hasOwnProperty(objProp)) {
          var name = jPropName + "_" + objProp;
          var t = getSJOTTypeFromLiteralObject(jsRoot, object[objProp],
                                               name,
                                               sjotRoot);
          obj[objProp] = t;
        }
      }
      return obj;
    default:
      return object;
  }
};

var getSJOTArrayTypeFromNode = function(jsRoot, jsNode, jPropName, sjotRoot) {
  var s;
  var inlineArray = false;
  var additionalItems = {};
  if (jsNode.hasOwnProperty("additionalItems")) {
    additionalItems = jsNode["additionalItems"];
  }
  if (additionalItems === true) {
    additionalItems = {};
  }

  if (Array.isArray(jsNode["items"])) {
    var maxItems = jsNode["maxItems"];
    var len = jsNode["items"].length;

    if ((additionalItems && maxItems <= len) ||
        (!additionalItems &&
          (((maxItems === undefined || maxItems <= len)) ||
           (maxItems !== undefined) && maxItems === len))) {
      /* make a tuple */
      s = [];
      if (maxItems !== undefined) {
        len = maxItems;
      }
      for (var i = 0; i < len; i++) {
        var t = toSJOT(jsRoot, jsNode["items"][i],
                       jPropName,
                       sjotRoot, undefined);
        s.push(t);
      }
      return [ s ];
    }
    else {
      /*
        NOTE:
        Since tuples can't have additional items
        in SJOT the same way they can in JSON Schema, we'll map an
        an extensible tuple onto
        any[minItems,maxItems] for now (by letting this fall through).
      */
    }
  }
  else if (jsNode.hasOwnProperty("items")) {
    if (jsNode["items"].hasOwnProperty("enum") ||
             (jsNode["items"].hasOwnProperty("type") &&
             jsNode["items"]["type"] === "object")) {
      inlineArray = true;

      var params = { 'jsNode': jsNode, 'objIndex': 0 }
      s = getSJOTInlineArraySkeletonFromNode(params);

      toSJOT(jsRoot, jsNode["items"],
             params['objIndex'],
             sjotRoot, s,
             false);
    }
    else {
      s = getSJOTTypeFromNode(jsRoot, jsNode["items"],
                              jPropName,
                              sjotRoot);
    }
  }

  if (s === undefined) {
    s = "any";
  }
  if (inlineArray === false) {
    s += getSJOTArraySuffixFromNode(jsNode);
  }

  return s;
};

var getSJOTInlineArraySkeletonFromNode = function(params) {
  return getSJOTInlineArraySkeleton(params);
}

var getSJOTInlineArraySkeleton = function(params) {
  var minItems = params['jsNode']['minItems'];
  var maxItems = params['jsNode']['maxItems'];
  var result = [];
  var maxIndex = 1;
  if (minItems !== undefined) {
    result[0] = minItems;
    maxIndex++;
    params['objIndex']++;
  }
  if (maxItems !== undefined) {
    result[maxIndex] = maxItems;
  }
  return result;
}

var getSJOTArraySuffixFromNode = function(jsNode) {
  return getSJOTArraySuffix(jsNode["minItems"],
                            jsNode["maxItems"],
                            jsNode["uniqueItems"]);
};

var getSJOTArraySuffix = function(minItems, maxItems, unique) {
  var l = unique ? "{" : "[";
  var r = unique ? "}" : "]";
  var s = l;
  if (minItems !== undefined) {
    s += minItems;
  }
  if (minItems !== undefined || maxItems !== undefined) {
    s += ",";
  }
  if (maxItems !== undefined) {
    s += maxItems;
  }
  s += r;
  return s;
};

var getSJOTObjectTypeFromNode = function(jsRoot, jsNode, jPropName, sjotRoot) {
  var obj = {};

  addNotesToNode(jsNode, obj, false);

  /* recursively add properties to the reference */
  if (jsNode.hasOwnProperty("properties")) {
    for (var objProp in jsNode["properties"]) {
      if (jsNode["properties"].hasOwnProperty(objProp)) {
        var propOpt = true;
        /* V4 required */
        if ((jsNode.hasOwnProperty("required")) &&
                       (jsNode["required"].indexOf(objProp) != -1)) {
          propOpt = false;
        }
        /* V3 required */
        if (jsNode["properties"][objProp].hasOwnProperty("required")) {
          propOpt = !jsNode["properties"][objProp]["required"];
        }
        toSJOT(jsRoot, jsNode["properties"][objProp],
               objProp,
               sjotRoot, obj,
               propOpt);
      }
    }
  }

  /* add explicit additionalProperties to patternProperties,
   to be converted to SJOT in next step */
  if (jsNode.hasOwnProperty("additionalProperties")) {
    if (typeof(jsNode["additionalProperties"]) === "boolean") {
      obj["@final"] = !jsNode["additionalProperties"];
    }
    else {
      if (!jsNode.hasOwnProperty("patternProperties")) {
        jsNode["patternProperties"] = {};
      }
      jsNode["patternProperties"][".*"] = jsNode["additionalProperties"];
    }
  }

  /* recursively convert patternProperties with regex prop name */
  if (jsNode.hasOwnProperty("patternProperties")) {
    for (var pattProp in jsNode["patternProperties"]) {
      if (jsNode["patternProperties"].hasOwnProperty(pattProp)) {
        var propName = getSJOTRegexType(pattProp);
        toSJOT(jsRoot, jsNode["patternProperties"][pattProp],
               propName,
               sjotRoot, obj,
               false);
      }
    }
  }

  /* add dependencies */
  if (jsNode.hasOwnProperty("dependencies")) {
    obj["@dep"] = {};
    for (var dep in jsNode["dependencies"]) {
      if (jsNode["dependencies"].hasOwnProperty(dep)) {

        /* convert single strings to an array (V3 -> V4)*/
        if (typeof(jsNode["dependencies"][dep]) === "string") {
          jsNode["dependencies"][dep] = [ jsNode["dependencies"][dep] ];
        }

        if (Array.isArray(jsNode["dependencies"][dep])) {
          obj["@dep"][dep] = jsNode["dependencies"][dep];
        }
        else {
          /* NOTE: schema dependencies not supported by SJOT */
        }
      }
    }
  }

  return obj;
};

var getSJOTNumberTypeFromNode = function(jsNode, isInteger) {
  /* divisibleBy -> multipleOf (V3 -> V4) */
  if (jsNode.hasOwnProperty("divisibleBy")) {
    jsNode["multipleOf"] = jsNode["divisibleBy"];
    delete jsNode["divisibleBy"];
  }

  var min, max;
  var xMin, xMax;
  if (jsNode.hasOwnProperty("minimum")) {
    min = jsNode["minimum"];
    if (!isInteger) {
      min = min.toFixed(1);
    }
  }
  if (jsNode.hasOwnProperty("maximum")) {
    max = jsNode["maximum"];
    if (!isInteger) {
      max = max.toFixed(1);
    }
  }
  if (jsNode.hasOwnProperty("exclusiveMinimum") &&
        jsNode["exclusiveMinimum"] === true) {
    xMin = true;
  }
  if (jsNode.hasOwnProperty("exclusiveMaximum") &&
        jsNode["exclusiveMaximum"] === true) {
    xMax = true;
  }

  return getSJOTNumberType(min, max, xMin, xMax, isInteger);
};

var getSJOTNumberType = function(min, max, xMin, xMax, isInteger) {
  var s = "";
  if (min !== undefined || max !== undefined) {
    if (xMin !== undefined) {
      s += "<";
    }
    if (min !== undefined) {
      s += min;
    }
    s += "..";
    if (max !== undefined) {
      s += max;
    }
    if (xMax !== undefined) {
      s += ">";
    }
  }
  else {
    if (isInteger) {
      s = "integer";
    }
    else {
      s = "number";
    }
  }
  return s;
};

var getSJOTStringTypeFromNode = function(jsNode, sjotRoot) {
  var s;
  /* converting format */
  if (jsNode.hasOwnProperty("format")) {
    switch (jsNode["format"]) {
      case "date-time":
        s = "datetime";
      break;
      case "email":
        /* faill through */
      case "hostname":
       /* fall through */
      case "ipv4":
      /* fall through */
      case "ipv6":
      /* fall through */
      case "uri":
        var f = jsNode["format"];
        var refName = f + "_type";
        if (!sjotRoot.hasOwnProperty(refName)) {
          sjotRoot[refName] = format_regex[f];
        }
        s = "#" + refName;
      break;
      default:
      break;
    }
  }
  else if (jsNode.hasOwnProperty("pattern")) {
    s = getSJOTRegexType(jsNode["pattern"]);
  }
  else {
    var minL, maxL;
    if (jsNode.hasOwnProperty("minLength")) {
      minL = jsNode["minLength"];
    }
    if (jsNode.hasOwnProperty("maxLength")) {
      maxL = jsNode["maxLength"];
    }
    s = getSJOTStringType(minL, maxL);
  }
  return s;
};

var getSJOTStringType = function(minL, maxL) {
  var s = "";
  if (minL !== undefined  || maxL !== undefined) {
    s = "char[";
    if (minL !== undefined) {
      s += minL;
    }
    s += ",";
    if (maxL !== undefined) {
      s += maxL;
    }
    s += "]";
  }
  else {
    s = "string";
  }
  return s;
};

var getSJOTRegexType = function(r, doEscape) {
  var start = 0, end = r.length;
  if (r[0] === "^") {
    start++;
  }
  if (r[r.length - 1] === "$") {
    end--;
  }
  r = r.substring(start, end);
  /* escape special chars */
  if (doEscape) {
    r = r.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
  }
  return "(" + r + ")";
};

var addNotesToNode = function(jsNode, sjotNode, withTitle) {
  var notes = "";
  if (withTitle) {
    if (jsNode.hasOwnProperty("title")) {
      notes += jsNode["title"];
      if (jsNode.hasOwnProperty("description")) {
        notes += ": ";
      }
    }
  }
  if (jsNode.hasOwnProperty("description")) {
    notes += jsNode["description"];
  }
  if (notes.length) {
    sjotNode["@note"] = notes;
  }
};

var getUnconflictingSJOTType = function(s, sjotRoot) {
  var count = 0;
  var prop = count ? s + "_" + count : s;
  while (sjotRoot.hasOwnProperty(prop)) {
    count++;
    prop = count ? s + "_" + count : s;
  }
  if (count) {
    s += "_" + count;
  }
  return s;
};

var format_regex = {
  "hostname":
    "((([a-zA-Z0-9]|[a-zA-Z0-9][-a-zA-Z0-9]*[a-zA-Z0-9])\\.)*" +
    "([A-Za-z0-9]|[A-Za-z0-9][-A-Za-z0-9]*[A-Za-z0-9]))",

  "ipv4":
    "(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\\.){3}([0-9]|" +
    "[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])$|^(([a-zA-Z]|[a-zA-Z][a-zA-Z0" +
    "-9\\-]*[a-zA-Z0-9])\\.)*([A-Za-z]|[A-Za-z][A-Za-z0-9\\-]*[A-Za-z0-9])$|" +
    "^\\s*((([0-9A-Fa-f]{1,4}:){7}([0-9A-Fa-f]{1,4}|:))|(([0-9A-Fa-f]{1,4}:)" +
    "{6}(:[0-9A-Fa-f]{1,4}|((25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)(\\.(25[0-5" +
    "]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){5}(((:[0-9" +
    "A-Fa-f]{1,4}){1,2})|:((25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)(\\.(25[0-5]" +
    "|2[0-4]\\d|1\\d\\d|[1-9]?\\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){4}(((:[0-9A" +
    "-Fa-f]{1,4}){1,3})|((:[0-9A-Fa-f]{1,4})?:((25[0-5]|2[0-4]\\d|1\\d\\d|[1" +
    "-9]?\\d)(\\.(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)){3}))|:))|(([0-9A-Fa-" +
    "f]{1,4}:){3}(((:[0-9A-Fa-f]{1,4}){1,4})|((:[0-9A-Fa-f]{1,4}){0,2}:((25[" +
    "0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)(\\.(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?" +
    "\\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){2}(((:[0-9A-Fa-f]{1,4}){1,5})|((:[0" +
    "-9A-Fa-f]{1,4}){0,3}:((25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)(\\.(25[0-5]" +
    "|2[0-4]\\d|1\\d\\d|[1-9]?\\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){1}(((:[0-9" +
    "A-Fa-f]{1,4}){1,6})|((:[0-9A-Fa-f]{1,4}){0,4}:((25[0-5]|2[0-4]\\d|1\\d" +
    "\\d|[1-9]?\\d)(\\.(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)){3}))|:))|(:(((" +
    ":[0-9A-Fa-f]{1,4}){1,7})|((:[0-9A-Fa-f]{1,4}){0,5}:((25[0-5]|2[0-4]\\d|" +
    "1\\d\\d|[1-9]?\\d)(\\.(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)){3}))|:)))(" +
    "%.+)?\\s*)",

  "ipv6":
    "((\\A([0-9a-f]{1,4}:){1,1}(:[0-9a-f]{1,4}){1,6}\\Z)|" +
    "(\\A([0-9a-f]{1,4}:){1,2}(:[0-9a-f]{1,4}){1,5}\\Z)|" +
    "(\\A([0-9a-f]{1,4}:){1,3}(:[0-9a-f]{1,4}){1,4}\\Z)|" +
    "(\\A([0-9a-f]{1,4}:){1,4}(:[0-9a-f]{1,4}){1,3}\\Z)|" +
    "(\\A([0-9a-f]{1,4}:){1,5}(:[0-9a-f]{1,4}){1,2}\\Z)|" +
    "(\\A([0-9a-f]{1,4}:){1,6}(:[0-9a-f]{1,4}){1,1}\\Z)|" +
    "(\\A(([0-9a-f]{1,4}:){1,7}|:):\\Z)|" +
    "(\\A:(:[0-9a-f]{1,4}){1,7}\\Z)|" +
    "(\\A((([0-9a-f]{1,4}:){6})(25[0-5]|2[0-4]\\d|[0-1]?\\d?\\d)" +
    "(\\.(25[0-5]|2[0-4]\\d|[0-1]?\\d?\\d)){3})\\Z)|" +
    "(\\A(([0-9a-f]{1,4}:){5}[0-9a-f]{1,4}:(25[0-5]|2[0-4]\\d|[0-1]?\\d?\\d)" +
    "(\\.(25[0-5]|2[0-4]\\d|[0-1]?\\d?\\d)){3})\\Z)|" +
    "(\\A([0-9a-f]{1,4}:){5}:[0-9a-f]{1,4}:(25[0-5]|2[0-4]\\d|[0-1]?\\d?\\d)" +
    "(\\.(25[0-5]|2[0-4]\\d|[0-1]?\\d?\\d)){3}\\Z)|" +
    "(\\A([0-9a-f]{1,4}:){1,1}(:[0-9a-f]{1,4}){1,4}:(25[0-5]|2[0-4]\\d|[0-1]" +
    "?\\d?\\d)(\\.(25[0-5]|2[0-4]\\d|[0-1]?\\d?\\d)){3}\\Z)|" +
    "(\\A([0-9a-f]{1,4}:){1,2}(:[0-9a-f]{1,4}){1,3}:(25[0-5]|2[0-4]\\d|[0-1]?" +
    "\\d?\\d)(\\.(25[0-5]|2[0-4]\\d|[0-1]?\\d?\\d)){3}\\Z)|" +
    "(\\A([0-9a-f]{1,4}:){1,3}(:[0-9a-f]{1,4}){1,2}:(25[0-5]|2[0-4]\\d|[0-1]?" +
    "\\d?\\d)(\\.(25[0-5]|2[0-4]\\d|[0-1]?\\d?\\d)){3}\\Z)|" +
    "(\\A([0-9a-f]{1,4}:){1,4}(:[0-9a-f]{1,4}){1,1}:(25[0-5]|2[0-4]\\d|[0-1]?" +
    "\\d?\\d)(\\.(25[0-5]|2[0-4]\\d|[0-1]?\\d?\\d)){3}\\Z)|" +
    "(\\A(([0-9a-f]{1,4}:){1,5}|:):(25[0-5]|2[0-4]\\d|[0-1]?\\d?\\d)" +
    "(\\.(25[0-5]|2[0-4]\\d|[0-1]?\\d?\\d)){3}\\Z)|" +
    "(\\A:(:[0-9a-f]{1,4}){1,5}:(25[0-5]|2[0-4]\\d|[0-1]?\\d?\\d)" +
    "(\\.(25[0-5]|2[0-4]\\d|[0-1]?\\d?\\d)){3}\\Z))",

    "uri":
      "(([a-z][a-z0-9+.-]*):(?:\\/\\/((?:(?=((?:[a-z0-9-._~!$&'()*+,;=:]|%" +
      "[0-9A-F]{2})*))(\\3)@)?(?=(\\[[0-9A-F:.]{2,}\\]|(?:[a-z0-9-._~!$&'(" +
      ")*+,;=]|%[0-9A-F]{2})*))\\5(?::(?=(\\d*))\\6)?)(\\/(?=((?:[a-z0-9-." +
      "_~!$&'()*+,;=:@\\/]|%[0-9A-F]{2})*))\\8)?|(\\/?(?!\\/)(?=((?:[a-z0-" +
      "9-._~!$&'()*+,;=:@\\/]|%[0-9A-F]{2})*))\\10)?)(?:\\?(?=((?:[a-z0-9-" +
      "._~!$&'()*+,;=:@\\/?]|%[0-9A-F]{2})*))\\11)?(?:#(?=((?:[a-z0-9-._~!$" +
      "&'()*+,;=:@\\/?]|%[0-9A-F]{2})*))\\12)?/i)",

    "email":
      "\\A(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+" +
      ")*|\"(?:[\\x01-\\x08\\x0b\\x0c\\x0e-\\x1f\\x21\\x23-\\x5b\\x5d-\\x7f]" +
      "|\\\\[\\x01-\\x09\\x0b\\x0c\\x0e-\\x7f])*\")@(?:(?:[a-z0-9](?:[a-z0-9" +
      "]*[a-z0-9])?\\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\\[(?:(?:25[0-5]|2[0" +
      "-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-" +
      "9]?|[a-z0-9-]*[a-z0-9]:(?:[\\x01-\\x08\\x0b\\x0c\\x0e-\\x1f\\x21-\\x5" +
      "a\\x53-\\x7f]|\\\\[\\x01-\\x09\\x0b\\x0c\\x0e-\\x7f])+)\\])\\z"
};
