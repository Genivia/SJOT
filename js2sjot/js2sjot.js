/* jshint sub:true */

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

//module.exports = JS2SJOT;

var js_2sjot = function(js, version) {
  var sjot = {};

  toSJOT(js, js, "@root", sjot, sjot, false);

  if (js.hasOwnProperty("definitions")) {
    for (var defProp in js["definitions"]) {
      if (js["definitions"].hasOwnProperty(defProp)) {
        var t = toSJOT(js, js["definitions"][defProp],
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
    propName = getSJOTPropertyFromNode(jsRoot, jsNode, jPropName, opt);
    typeName = getSJOTTypeFromNode(jsRoot, jsNode, jPropName, sjotRoot);

    if (sjotNode !== undefined)
      sjotNode[propName] = typeName;

    return typeName;
  }

  if (jsNode.hasOwnProperty("type")) {
    if (Array.isArray(jsNode["type"])) {
      /* array of primitive types */
      propName = getSJOTPropertyFromNode(jsRoot, jsNode, jPropName, opt);
      typeName = getSJOTTypeFromNode(jsRoot, jsNode, jPropName, sjotRoot);
    }
    else {
      /* single type */
      switch (jsNode["type"]) {
        case "object":
          propName = getSJOTPropertyFromNode(jsRoot, jsNode, jPropName, opt);
          typeName = getSJOTTypeFromNode(jsRoot, jsNode,
                             (jPropName === "@root") ? "root" : jPropName,
                             sjotRoot);

          if (sjotNode !== undefined)
            sjotNode[propName] = typeName;

          if (typeName.startsWith("#")) {
            /* make type on SJOT root to reference */
            var ref = typeName.substring(1);
            /* FIXME: this fixes additionalProperties in a
              nested object, but does it break anything else? */
            ref = getUnconflictingSJOTType(ref, sjotRoot);
            sjotRoot[ref] = {};

            addNotesToNode(jsNode, sjotRoot[ref], false);

            /* recursively add properties to the reference */
            if (jsNode.hasOwnProperty("properties")) {
              for (var objProp in jsNode["properties"]) {
                if (jsNode["properties"].hasOwnProperty(objProp)) {
                  var propOpt = true;
                  if ((jsNode.hasOwnProperty("required")) &&
                                 (jsNode["required"].indexOf(objProp) != -1)) {
                    propOpt = false;
                  }
                  var t = toSJOT(jsRoot, jsNode["properties"][objProp],
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
                  propName = getSJOTRegexType(pattProp);
                  toSJOT(jsRoot, jsNode["patternProperties"][pattProp],
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
        /* end case "object" */

        case "array":
          if (jsNode.hasOwnProperty("items") &&
              !Array.isArray(jsNode["items"]) &&
            jsNode["items"].hasOwnProperty("type")) {
                propName = getSJOTPropertyFromNode(jsRoot, jsNode["items"], jPropName, opt);
                if (jsNode["items"]["type"] === "object") {
                  typeName = toSJOT(jsRoot, jsNode["items"],
                              jPropName,
                              sjotRoot, sjotNode,
                              opt);
                  /* nasty fix but it works */
                  typeName += getSJOTArraySuffixFromNode(jsNode);
                }
                else {
                  typeName = getSJOTTypeFromNode(jsRoot, jsNode, jPropName, sjotRoot);
                }
          }
          else {
            propName = getSJOTPropertyFromNode(jsRoot, jsNode, jPropName, opt);
            typeName = getSJOTTypeFromNode(jsRoot, jsNode, jPropName, sjotRoot);
          }
        break; /* end case "array" */

        default:
          propName = getSJOTPropertyFromNode(jsRoot, jsNode, jPropName, opt);
          typeName = getSJOTTypeFromNode(jsRoot, jsNode, undefined, sjotRoot);
        break;
      } /* end switch(jsNode["type"])  */
    } /* end single type */

    if (sjotNode !== undefined)
      sjotNode[propName] = typeName;

    return typeName;
  } /* end jsNode has property "type" */
  else if (jsNode.hasOwnProperty("$ref")) {
    propName = getSJOTPropertyFromNode(jsRoot, jsNode, jPropName, opt);
    typeName = getSJOTTypeFromReference(jsNode["$ref"]);

    if (sjotNode !== undefined)
      sjotNode[propName] = typeName;

    return typeName;
  }
};

var getSJOTPropertyFromNode = function(jsRoot, jsNode, jPropName, optional) {
  var s = jPropName;
  if (optional) {
    var node;
    if (jsNode.hasOwnProperty("$ref")) {
      /* grab the ref leaf's default value */
      /* FIXME: do we want to grab the first default value we see? */
      node = resolveJSONPointer(jsRoot, jsRoot, jsNode["$ref"]);
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
};

var getSJOTTypeFromNode = function(jsRoot, jsNode, jPropName, sjotRoot) {
  if (jPropName === "(.*)") {
    jPropName = "addProps"; /* renaming "additionalProperties" */
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
    return "any";
  }

  /* normal type case */
  var s;
  if (typeof(jsNode["type"]) === "string") {
    /* single type */
    switch(jsNode["type"]) {
      case "object":
        s = getSJOTObjectTypeFromNode(jsNode, jPropName, sjotRoot);
      break;
      case "array":
        s = getSJOTArrayTypeFromNode(jsRoot, jsNode, jPropName, sjotRoot);
      break;
      case "boolean":
        /* falls through */
      case "null":
        s = jsNode["type"];
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
    /* array of SIMPLE types -> SJOT union of simple types */
    s = [];
    var types = [];
    for (var ti = 0; ti < jsNode["type"].length; ti++) {
      types.push(getSJOTTypeFromNode(jsRoot, { "type": jsNode["type"][ti] }, jPropName, sjotRoot));
    }
    s.push(types);
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

  /* turn JSON schema in enum array into SJOT union */
  /*
    Values can be ANY type. Validation succeeds only
    with the EXACT literal object given.

    Type of object -> SJOT representation
    -------------------------------------
    string -> "(s)"
    number/integer -> "n..n"
    null -> "null"
    boolean -> "boolean" (FIXME: how to specifiy true/false?)
    array -> "<type_of_array>" + "array suffix" (like normal)
    object -> "#reference" where reference is a reference to a root schema

    Note that given objects are literal and not in JSON Schema format.
    Thus, we will convert the values of the object's properties recursively
    using the same format as above, with all properties required (no changes
    needed to the property names).
  */
  var union = [];
  var types = [];
  if (jPropName === "@root") jPropName = "root";
  for (var i = 0; i < enums.length; i++) {
    var t = getSJOTTypeFromLiteralObject(jsRoot, enums[i],
                                jPropName + "_enum",
                                sjotRoot);
    console.log(t);
    types.push(t);
  }
  union.push(types);
  return union;
};

var getSJOTTypeFromLiteralObject = function(jsRoot, object, jPropName, sjotRoot) {
  if (object === null)
    return "null";

  if (Array.isArray(object)) {
    /* TODO: */
    return "";
  }

  switch (typeof(object)) {
    case "boolean":
      return "boolean"; /* FIXME: how to represent a single true/false? */
    case "string":
      return getSJOTRegexType(object, true);
    case "number":
      /* falls through */
    case "integer":
      return getSJOTNumberType(object, object, false, false, false);
    case "object":
      if (!Object.keys(object).length)
        return {};

      /* make a reference */
      if (jPropName === "@root") jPropName = "root";
      jPropName += "";
      var ref = getUnconflictingSJOTType(jPropName, sjotRoot);
      sjotRoot[ref] = {};

      /* recursively convert literal property values to SJOT types */
      for (var objProp in object) {
        if (object.hasOwnProperty(objProp)) {
          var name = jPropName + "_" + objProp;
          console.log("doing object: " + objProp);
          console.log(object[objProp]);
          var t = getSJOTTypeFromLiteralObject(jsRoot, object[objProp],
                                               name,
                                               sjotRoot);
          sjotRoot[ref][objProp] = t;
        }
      }

      return "#" + ref;
    default:
      return object;
  }
};

var getSJOTArrayTypeFromNode = function(jsRoot, jsNode, jPropName, sjotRoot) {
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
          var t = toSJOT(jsRoot, jsNode["items"][i], jPropName, sjotRoot, undefined);
          s.push(t);
        }
      }
      else {
        /*
          NOTE:
          Since tuples can't be extended in SJOT the same way they
          can be in JSON Schema, we'll map an extensible tuple onto
          any[sizeOfTuple,] for now.
        */
        s = "any[" + jsNode["items"].length + ",]";
      }
    }
    else {
      s = getSJOTTypeFromNode(jsRoot, jsNode["items"], jPropName, sjotRoot);
    }
  }
  else {
    s = "any";
  }
  s += getSJOTArraySuffixFromNode(jsNode);
  return s;
};

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

var getSJOTObjectTypeFromNode = function(jsNode, jPropName, sjotRoot) {
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
    s = getUnconflictingSJOTType(s, sjotRoot);
    s = "#" + s;
  }
  return s;
};

var getSJOTNumberTypeFromNode = function(jsNode, isInteger) {
  var s = "";
  var min, max;
  var xMin, xMax;
  if (jsNode.hasOwnProperty("minimum")) {
    min = jsNode["minimum"];
    if (!isInteger) min = min.toFixed(1);
  }
  if (jsNode.hasOwnProperty("maximum")) {
    max = jsNode["maximum"];
    if (!isInteger) max = max.toFixed(1);
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
    if (xMin !== undefined) s += "<";
    if (min !== undefined) s += min;
    s += "..";
    if (max !== undefined) s += max;
    if (xMax !== undefined) s += ">";
  }
  else {
    if (isInteger)
      s = "integer";
    else
      s = "number";
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
    if (minL !== undefined)
      s += minL;
    s += ",";
    if (maxL !== undefined)
      s += maxL;
    s += "]";
  }
  else {
    s = "string";
  }
  return s;
};

var getSJOTRegexType = function(r, doEscape) {
  var start = 0, end = r.length;
  if (r[0] === "^")
    start++;
  if (r[r.length - 1] === "$")
    end--;
  r = r.substring(start, end);
  /* escape special chars */
  if (doEscape)
    r = r.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
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
