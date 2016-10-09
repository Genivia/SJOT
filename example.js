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

try {
  SJOT.validate(obj, null, schema);
  console.log("OK! JSON data is valid");
} catch (e) {
  console.log(e);
}
