var SJOT = require("sjot");

var schema =
{
  "Data": {
    "id":    "string",
    "v":     "number",
    "tags?": "string{1,}"
  }
};

var obj =
{
  "id":   "SJOT",
  "v":    1.0,
  "tags": [ "JSON", "SJOT" ]
};

SJOT.check(schema);
SJOT.validate(obj, null, schema);
console.log("OK!");
