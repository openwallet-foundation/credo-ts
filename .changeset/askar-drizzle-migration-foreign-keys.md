---
'@credo-ts/askar-to-drizzle-storage-migration': patch
---

Fixed the migration of records that reference other records, such as mediation records, basic messages and proof exchanges, which reference a connection. The migrator inserted the records in the order of one scan over the Askar store. When a child record came before its parent, the insert failed with a foreign key violation, so a mediator could not migrate. The migrator now migrates one record type at a time, in the order of the foreign keys between the tables.

A record whose parent record does not exist in the Askar store, for example a basic message of a deleted connection, is not migrated, and the migrator logs a warning with the number of these records. Drizzle deletes these records together with their parent record.

The migrator now finds records without a registered adapter before it writes records for a context. When `skipMigrationForMissingAdapter` is `false`, it throws before the first insert.
