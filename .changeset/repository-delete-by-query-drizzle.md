---
'@credo-ts/drizzle-storage': patch
---

Implement `deleteByQuery` in the `DrizzleStorageService`, which deletes all records matching a query with a single `DELETE` statement.
