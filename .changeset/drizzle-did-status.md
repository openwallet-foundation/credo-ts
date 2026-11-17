---
'@credo-ts/drizzle-storage': patch
---

Adds the `status` column to the `Did` table, for the new `DidRecord` status. Existing dids are set to `active`. Apply it with the drizzle storage migrations.
