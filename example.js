var SJOT = require("sjot");

var schema =
{
   "@root": {
      "name":    "string",
      "v?1.0":   "number",
      "tags?":   "string{1,}",
      "package": { "id": "1..", "name": "char[1,]" }
   }
};

var data =
{
      "name":    "SJOT",
      "v":       1.1,
      "tags":    [ "JSON", "SJOT" ],
      "package": { "id": 1, "name": "sjot" }
};

try {
  SJOT.validate(data, "@root", schema);
  console.log("OK! JSON data is valid");
} catch (e) {
  console.log(e);
}
