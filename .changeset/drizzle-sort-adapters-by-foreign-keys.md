---
'@credo-ts/drizzle-storage': patch
---

Added `sortAdaptersByForeignKeys`, which sorts record adapters so that an adapter comes after the adapters whose tables its table references. Added `getAdapterForeignKeys`, which returns the foreign keys of the table of an adapter, with the columns in the values of the adapter. The Askar to Drizzle migration uses them to insert parent records before child records, and to find child records whose parent record does not exist.
