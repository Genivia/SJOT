/*
  A converter from JSON schemas to SJOT schemas.
*/

"use strict";

class JS2SJOT {
  static toSJOT(schema, version) {
    var js = schema;
    if (typeof js === "string")
      js = JSON.parse(js);
    if (Array.isArray(js)) {
      var schemas = [];
      for (var i = 0; i < js.length; i++)
        schemas.push(js_2sjot(js[i], version));
      return schemas;
    }
    else {
      return js_2sjot(js, version);
    }
  }
}

module.exports = JS2SJOT;

var js_2sjot = function(js, version) {
  var sjot = {};

  js_2sjot_go(js, js, "@root", sjot, sjot, false);

  if (js.hasOwnProperty("definitions")) {
    for (var defProp in js["definitions"]) {
      if (js["definitions"].hasOwnProperty(defProp)) {
        var t = js_2sjot_go(js, js["definitions"][defProp],
                    defProp,
                    sjot, sjot,
                    false);
      }
    }
  }

  return sjot;
};

var js_ref2sjot = function(ref) {
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

var js_2sjot_go = function(jsRoot, jsNode, jPropName, sjotRoot, sjotNode, optional) {
  var propName, typeName;

  var opt = (optional === undefined) ? true : optional;

  /* TODO: fix this */
  if (jsNode.hasOwnProperty("id")) {
    if (typeof(jsNode["id"]) == "string") {
      if (sjotNode !== undefined)
        sjotNode["@id"] = jsNode["id"];
    }
  }

  if (jsNode.hasOwnProperty("enum")) {
    propName = getPropName(jsRoot, jsNode, jPropName, opt);
    typeName = getType(jsRoot, jsNode, jPropName, sjotRoot);

    if (sjotNode !== undefined)
      sjotNode[propName] = typeName;

    return typeName;
  }

  if (jsNode.hasOwnProperty("type")) {
    if (Array.isArray(jsNode["type"])) {
      /* array of primitive types */
      propName = getPropName(jsRoot, jsNode, jPropName, opt);
      typeName = getType(jsRoot, jsNode, jPropName, sjotRoot);
    }
    else {
      /* single type */
      switch (jsNode["type"]) {
        case "object":
          propName = getPropName(jsRoot, jsNode, jPropName, opt);
          typeName = getType(jsRoot, jsNode,
                             (jPropName === "@root") ? "root" : jPropName,
                             sjotRoot);

          if (sjotNode !== undefined)
            sjotNode[propName] = typeName;

          if (typeName.startsWith("#")) {
            /* make type on SJOT root to reference */
            var ref = typeName.substring(1);
            /* FIXME: this fixes additionalProperties in a
              nested object, but does it break anything else? */
            ref = makeUnconflictingName(ref, sjotRoot);
            sjotRoot[ref] = {};

            addNotes(jsNode, sjotRoot[ref], false);

            /* recursively add properties to the reference */
            if (jsNode.hasOwnProperty("properties")) {
              for (var objProp in jsNode["properties"]) {
                if (jsNode["properties"].hasOwnProperty(objProp)) {
                  var propOpt = true;
                  if ((jsNode.hasOwnProperty("required")) &&
                                 (jsNode["required"].indexOf(objProp) != -1)) {
                    propOpt = false;
                  }
                  var t = js_2sjot_go(jsRoot, jsNode["properties"][objProp],
                              objProp,
                              sjotRoot, sjotRoot[ref],
                              propOpt);
                }
              }
            }


            /* add explicit additionalProperties to patternProperties,
             to be converted to SJOT in next step */
            if (jsNode.hasOwnProperty("additionalProperties")) {
              if (typeof(jsNode["additionalProperties"]) === "boolean") {
                sjotNode["@final"] = !jsNode["additionalProperties"];
              }
              else {
                if (!jsNode.hasOwnProperty("patternProperties"))
                  jsNode["patternProperties"] = {};
                jsNode["patternProperties"][".*"] = jsNode["additionalProperties"];
              }
            }

            /* recursively convert patternProperties with regex prop name */
            if (jsNode.hasOwnProperty("patternProperties")) {
              for (var pattProp in jsNode["patternProperties"]) {
                if (jsNode["patternProperties"].hasOwnProperty(pattProp)) {
                  console.log("adding " + pattProp + " to ref " + ref);
                  propName = getRegex(pattProp);
                  var t = js_2sjot_go(jsRoot, jsNode["patternProperties"][pattProp],
                              propName,
                              sjotRoot, sjotRoot[ref],
                              false);
                }
              }
            }

            /* NOTE: dependencies (property nor schema) aren't supported yet */
            if (jsNode.hasOwnProperty("dependencies")) {
              for (var dep in jsNode["dependencies"]) {
                if (jsNode["dependencies"].hasOwnProperty(dep)) {
                  if (Array.isArray(jsNode["dependencies"][dep])) {
                    /* property dependencies not supported yet */
                  }
                  else {
                    /* schema dependencies not supported  yet */
                  }
                }
              }
            }
          } /* end typeName.startsWith("#") */

          return typeName;
        break; /* end case "object" */

        case "array":
          if (jsNode.hasOwnProperty("items") &&
              !Array.isArray(jsNode["items"]) &&
            jsNode["items"].hasOwnProperty("type")) {
                propName = getPropName(jsRoot, jsNode["items"], jPropName, opt);
                if (jsNode["items"]["type"] === "object") {
                  typeName = js_2sjot_go(jsRoot, jsNode["items"],
                              jPropName,
                              sjotRoot, sjotNode,
                              opt);
                  /* nasty fix but it works */
                  typeName += getArraySuffix(jsNode);
                }
                else {
                  typeName = getType(jsRoot, jsNode, jPropName, sjotRoot);
                }
          }
          else {
            propName = getPropName(jsRoot, jsNode, jPropName, opt);
            typeName = getType(jsRoot, jsNode, jPropName, sjotRoot);
          }
        break; /* end case "array" */

        default:
          propName = getPropName(jsRoot, jsNode, jPropName, opt);
          typeName = getType(jsRoot, jsNode, undefined, sjotRoot);
        break;
      } /* end switch(jsNode["type"])  */
    } /* end single type */

    if (sjotNode !== undefined)
      sjotNode[propName] = typeName;

    return typeName;
  } /* end jsNode has property "type" */
  else if (jsNode.hasOwnProperty("$ref")) {
    propName = getPropName(jsRoot, jsNode, jPropName, opt);
    typeName = js_ref2sjot(jsNode["$ref"]);

    if (sjotNode !== undefined)
      sjotNode[propName] = typeName;

    return typeName;
  }
};

var getPropName = function(jsRoot, jsNode, jPropName, optional) {
  var s = jPropName;
  if (optional) {
    var node;
    if (jsNode.hasOwnProperty("$ref")) {
      /* grab the ref leaf's default value */
      /* FIXME: do we want to grab the first default value we see? */
      node = resolveJSONPointer(jsRoot, jsRoot, jsNode["$ref"])
    }
    else {
      node = jsNode;
    }
    if (jPropName != "@root") {
      s += "?";
    }
    if (node.hasOwnProperty("default")) {
      var def = node["default"];
      if (def === "")
        def = "null";
      s += def;
    }
  }
  return s;
};

var resolveJSONPointer = function(jsRoot, jsNode, ptr) {
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
  if (nextProp === "#")
    return resolveJSONPointer(jsRoot, jsRoot, ptr);
  if (nextProp.length)
    return resolveJSONPointer(jsRoot, jsNode[nextProp], ptr);
  if (jsNode.hasOwnProperty("$ref"))
    return resolveJSONPointer(jsRoot, jsRoot, jsNode["$ref"]);
  return jsNode;
}

var getType = function(jsRoot, jsNode, jPropName, sjotRoot) {
  if (jPropName === "(.*)") {
    jPropName = "addProps"; /* renaming "additionalProperties" */
  }

  /* enum types */
  if (jsNode.hasOwnProperty("enum")) {
    var types = [];
    if (jsNode.hasOwnProperty("type")) {
      types = jsNode["type"];
      if (typeof(types) == "string") {
        types = [ types ];
      }
    }

    /* remove default value not in the enum */
    if (jsNode.hasOwnProperty("default")) {
      if (jsNode["enum"].indexOf(jsNode["default"]) === -1) {
        delete jsNode["default"];
      }
    }
    /*
      FIXME:
      This doesn't account for other schema requirements.
      For example,
       "type": "integer",
       "minimum": 5,
       "enum": [ 1 ]
      will let 1 through because it's an integer.
      Possibly make multiple versions of function for different primitive types?
      Possibly make getEnumRegex take a general filter function?
    */
    /*
      FIXME: this is only the case for strings
      every other type or combo, convert to SJOT union
      with regex/references after filtering by types.
    */
    return getEnumRegex(jsNode["enum"], types);
  }

  /* get the reference type */
  if (jsNode.hasOwnProperty("$ref")) {
    return js_ref2sjot(jsNode["$ref"]);
  }

  /* no specified type */
  if (!jsNode.hasOwnProperty("type")) {
    return "any";
  }

  /* normal type case */
  var s;
  if (typeof(jsNode["type"]) === "string") {
    /* single type */
    switch(jsNode["type"]) {
      case "object":
        s = getObjectType(jsNode, jPropName, sjotRoot);
      break;
      case "array":
        s = getArrayType(jsNode);
      break;
      case "boolean":
        /* falls through */
      case "null":
        s = jsNode["type"];
      break;
      case "number":
        var isFloat = true;
        /* falls through */
      case "integer":
        s = getIntegerType(jsNode, isFloat);
      break;
      case "string":
        s = getStringType(jsNode);
      break;
      default:
        s = jsNode["type"];
    }
  }
  else {
    /* array of SIMPLE types -> SJOT union of simple types */
    s = [];
    var sInside = [];
    for (var ti = 0; ti < jsNode["type"].length; ti++) {
      sInside.push(getType(jsRoot, { "type": jsNode["type"][ti] }, jPropName, sjotRoot));
    }
    s.push(sInside);
  }

  return s;
};

var getArrayType = function(jsNode) {
  var s;
  /* FIXME: JSON schema arrays have additionalItems: true by default.
  in the sjot2js conveter this isnt upheld
  */
  var additionalItems = {};
  if (jsNode.hasOwnProperty("additionalItems")) {
    additionalItems = jsNode["additionalItems"];
  }
  if (additionalItems === true)
    additionalItems = {};

  if (jsNode.hasOwnProperty("items")) {
    if (Array.isArray(jsNode["items"])) {
      if (additionalItems === false) {
        /*
          FIXME:
          do we need to also check minItems and maxItems?
        */
        s = [];
        for (var i = 0; i < jsNode["items"].length; i++) {
          var t = js_2sjot_go(jsRoot, jsNode["items"][i], jPropName, sjotRoot, undefined);
          s.push(t);
        }
        break;
      }
      else {
        /*
          NOTE:
          Since tuples can't be extended in SJOT the same way they
          can be in JSON Schema, we'll map an extensible tuple onto
          any[sizeOfTuple,] for now.
        */
        s = "any[" + jsNode["items"].length + ",]";
        break;
      }
    }
    else {
      s = getType(jsRoot, jsNode["items"], jPropName, sjotRoot);
    }
  }
  else {
    s = "any";
  }
  s += getArraySuffix(jsNode);
  return s;
}

var getArraySuffix = function(jsNode) {
  var s = "";
  var minItems = jsNode["minItems"];
  var maxItems = jsNode["maxItems"];
  var unique = jsNode["uniqueItems"];
  var l = unique ? "{" : "[";
  var r = unique ? "}" : "]";
  s += l;
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
}

var getObjectType = function(jsNode, jPropName, sjotRoot) {
  var s;
  var hasTitle = jsNode.hasOwnProperty("title");
  var hasProperties = jsNode.hasOwnProperty("properties");
  var hasPatternProperties = jsNode.hasOwnProperty("patternProperties");
  var hasAdditionalProperties = jsNode.hasOwnProperty("additionalProperties");
  var hasAnyProperties = (hasProperties ||
                          hasPatternProperties ||
                          hasAdditionalProperties);
  var isSimpleObject = !(hasAnyProperties ||
                         hasTitle);
  if (isSimpleObject) {
    s = "object";
  }
  else {
    s = (jsNode["title"] || jPropName);
    if (s === jPropName) {
      s += "_type";
    }
    s = makeUnconflictingName(s, sjotRoot);
    s = "#" + s;
  }
  return s;
}

var getIntegerType = function(jsNode, isFloat) {
  var s = "";
  var min, max;
  var xMin, xMax;
  if (jsNode.hasOwnProperty("minimum")) {
    min = jsNode["minimum"];
    if (isFloat) min = min.toFixed(1);
  }
  if (jsNode.hasOwnProperty("maximum")) {
    max = jsNode["maximum"];
    if (isFloat) max = max.toFixed(1);
  }
  if (jsNode.hasOwnProperty("exclusiveMinimum") &&
        jsNode["exclusiveMinimum"] === true) {
    xMin = true;
  }
  if (jsNode.hasOwnProperty("exclusiveMaximum") &&
        jsNode["exclusiveMaximum"] === true) {
    xMax = true;
  }
  if (min !== undefined || max !== undefined) {
    if (xMin !== undefined) s += "<";
    if (min !== undefined) s += min;
    s += "..";
    if (max !== undefined) s += max;
    if (xMax !== undefined) s += ">";
  }
  else {
    s = jsNode["type"];
  }
  return s;
}

var getStringType = function(jsNode) {
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
    s = getRegex(jsNode["pattern"]);
  }
  else {
    var minL, maxL;
    if (jsNode.hasOwnProperty("minLength")) {
      minL = jsNode["minLength"];
    }
    if (jsNode.hasOwnProperty("maxLength")) {
      maxL = jsNode["maxLength"];
    }
    if (minL !== undefined  || maxL !== undefined) {
      s = "char[";
      if (minL !== undefined)
        s += minL;
      s += ",";
      if (maxL !== undefined)
        s += maxL;
      s += "]";
    }
    else {
      s = jsNode["type"];
    }
  }
  return s;
}

var getRegex = function(r) {
  var start = 0, end = r.length;
  if (r[0] === "^")
    start++;
  if (r[r.length - 1] === "$")
    end--;
  r = r.substring(start, end);
  return "(" + r + ")";
};

var getEnumRegex = function(enumArray, filterByTypesArray) {
  var regex = "(";
  if (enumArray.length) {
    if (filterByTypesArray && filterByTypesArray.length) {
      enumArray = enumArray.filter(function(e, i, a) {
        for (var j = 0; j < filterByTypesArray.length; j++) {
          if (typeof(e) === filterByTypesArray[j]) {
            return true;
          }
          if (filterByTypesArray[j] === "integer") {
            if (typeof(e) === "number" &&
                Math.floor(e) === e) {
              return true;
            }
          }
        }
        return false;
      });
    }
    for (var i = 0; i < enumArray.length-1; i++) {
      var r = enumArray[i];
      /* escape special chars */
      r = r.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
      regex += r + "|";
    }
    if (enumArray.length)
      regex += enumArray[enumArray.length-1];
  }
  regex += ")";
  return regex;
};

var addNotes = function(jsNode, sjotNode, withTitle) {
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

var makeUnconflictingName = function(s, sjotRoot) {
  var count = 0;
  var prop = count ? s + "_" + count : s;
  while (sjotRoot.hasOwnProperty(prop)) {
    count++;
    prop = count ? s + "_" + count : s;
  }
  if (count)
    s += "_" + count;
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
