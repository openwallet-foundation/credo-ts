---
'@credo-ts/drizzle-storage': patch
---

Fixed storing DIDComm proof exchange records in Postgres. The `state` column of the `DidcommProofExchange` table used the role enum, so every insert was rejected. A new migration changes the column to the state enum, apply it with the drizzle storage migrations. SQLite was not affected.
