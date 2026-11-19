---
'@credo-ts/askar-to-drizzle-storage-migration': patch
---

Fixed the migration of records that reference other records, such as mediation records, basic messages and proof exchanges, which reference a connection. The migrator inserted the records in the order of one scan over the Askar store. When a child record came before its parent, the insert failed with a foreign key violation, so a mediator could not migrate. The migrator now migrates one record type at a time, in the order of the foreign keys between the tables.
