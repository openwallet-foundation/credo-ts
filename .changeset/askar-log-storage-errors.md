---
'@credo-ts/askar': patch
---

A duplicate or missing entry in a store session is no longer logged as an error, as it is not a failure of the store. A failing query is now logged as an error.
