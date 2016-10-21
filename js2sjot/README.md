# JSON Schema to SJOT Schema Converter

Work in progress.

## Implemented

### Types
- "null"
- "boolean"
- "number", "integer"
  - Keywords: "maximum", "minimum", "exclusiveMinimum", "exclusiveMaximum"
- "string"
  - Keywords: "minLength", "maxLength", "pattern"
- "object"
  - Keywords: "required", "properties", "additionalProperties", "additionalProperties"
- "array"
  - Keywords: "minItems", "maxItems", "uniqueItems", "items", "additionalItems"

### Keywords
- "types" being an array of simple types
- "$ref"
  - Currently only JSON path references for now.
- "title"
- "description"
- "default"
- "format"
  - "date-time", "email", "hostname", "ipv4", "ipv6", "uri"
- "definitions"
  - Currently only converting root-level schemas. Nested schemas will be converted future versions.

## In progress

### General
- Options for different JSON Schema versions. Currently only version 4.

### Keywords
- "id" and "$ref" to ids
- "enum"
  - Currently only implemented (naively) for "string" type
- "allOf"
- "anyOf"
- "oneOf"
