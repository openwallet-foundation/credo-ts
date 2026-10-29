---
'@credo-ts/core': patch
---

The `values` of a DCQL claims query now match mdoc full-date and tdate data elements, compared as their `YYYY-MM-DD` and RFC 3339 strings. Before, they never matched.
