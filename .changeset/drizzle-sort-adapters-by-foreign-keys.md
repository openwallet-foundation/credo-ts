---
'@credo-ts/drizzle-storage': patch
---

Added `sortAdaptersByForeignKeys`, which sorts record adapters so that an adapter comes after the adapters whose tables its table references. The Askar to Drizzle migration uses it to insert parent records before child records.
