---
'@credo-ts/core': patch
---

`CachedStorageService` now writes a record to the cache only after the underlying storage has saved or updated it. Before, a save or update that failed in storage (for example with a `RecordDuplicateError`) left the unsaved record in the cache, and a later `getById` returned a record that did not exist in storage.
