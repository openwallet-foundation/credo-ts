---
'@credo-ts/drizzle-storage': patch
---

Postgres queries on custom tags now compare values with their type, like the SQLite backend already did. A query for the string `'true'` no longer matches a tag stored as the boolean `true`, and the other way around.
