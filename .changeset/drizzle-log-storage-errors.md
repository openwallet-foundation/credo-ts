---
'@credo-ts/drizzle-storage': patch
---

The storage logs an error when a database operation fails. A failed query error now has the database error as its `cause`.
