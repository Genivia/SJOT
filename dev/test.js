var SJOT = require("sjot");

var schema =
{
  "@note": "SJOT schema test types",
  "@root": "#Data",
  "Data": {
    "any":          "any",
    "atom":         "atom",
    "boolean":      "boolean",
    "byte":         "byte",
    "short":        "short",
    "int":          "int",
    "long":         "long",
    "ubyte":        "ubyte",
    "ushort":       "ushort",
    "uint":         "uint",
    "ulong":        "ulong",
    "integer":      "integer",
    "float":        "float",
    "double":       "double",
    "number":       "number",
    "n,m":          "-999,-1,0,1,999",
    "n..m":         "-10..10",
    "<n..m>":       "<-10..10>",
    "string":       "string",
    "base64":       "base64",
    "hex":          "hex",
    "date":         "date",
    "time":         "time",
    "datetime":     "datetime",
    "duration":     "duration",
    "char":         "char",
    "char10":       "char[1,10]",
    "regex":        "(regex)",
    "strings":      "string[]",
    "strings10":    "string[1,10]",
    "stringset":    "string{}",
    "stringset10":  "string{1,10}",
    "#ref":         "#ref",
    "object":       "object",
    "array":        "array",
    "null":         "null",
    "obj":          { "optional?": "string", "[a]": "number", "(\\w+)": "number" },
    "tuple":        [ "string", "number" ],
    "union":        [[ "string", "number" ]]
  },
  "Derived": {
    "@extends": "#Data",
    "@final":   true,
    "extra":    "any"
  },
  "ref": "boolean"
};

var data =
{
  "any":          { "some": "data" },
  "atom":         true,
  "boolean":      false,
  "byte":         127,
  "short":        32767,
  "int":          2147483647,
  "long":         140737488355327,
  "ubyte":        255,
  "ushort":       65535,
  "uint":         4294967295,
  "ulong":        18446744073709551615,
  "integer":      123,
  "float":        123.456,
  "double":       123.456789,
  "number":       999,
  "n,m":          -999,
  "n..m":         -10,
  "<n..m>":       -9,
  "string":       "string",
  "base64":       "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",
  "hex":          "0123456789abcdefABCDEF",
  "date":         "1929-12-31",
  "time":         "23:59:59",
  "datetime":     "1929-12-31T23:59:59",
  "duration":     "PT0S",
  "char":         "c",
  "char10":       "char[1,10]",
  "regex":        "regex",
  "strings":      [ "string1", "string2", "string3" ],
  "strings10":    [ "string1", "string2", "string3" ],
  "stringset":    [ "string1", "string2", "string3" ],
  "stringset10":  [ "string1", "string2", "string3" ],
  "#ref":         true,
  "object":       { "some": "data" },
  "array":        [ 1, "a", null, true ],
  "null":         null,
  "obj":          { "[a]": 0, "a": 1, "b": 2 },
  "tuple":        [ "string", 123 ],
  "union":        123
};

SJOT.check(schema);
SJOT.validate(data, null, schema);
console.log("OK!");
