---
'@credo-ts/drizzle-storage': patch
---

Custom tag names and array tag values in Postgres queries are now passed as query parameters. Tag values containing a single quote no longer cause a query error.
