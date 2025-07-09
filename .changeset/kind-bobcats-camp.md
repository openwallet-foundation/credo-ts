---
"@credo-ts/drizzle-storage": minor
---

feat: add support for new SQLite and PostgreSQL storage based on Drizzle.

The Drizzle Storage Module is an additional storage implementation for Credo which natively integrates with PostgreSQL and SQLite. It can be combined with Aries Askar as the KMS.

The Drizzle Storage Module does not introduce any breaking chnages to how the storage APIs works in Credo, and for new projects you only have to configure the Drizzle module to connect to your database.
