---
'@credo-ts/core': patch
---

With `useCachedStorageService` enabled, `Repository.updateByIdWithLock` now uses the lock of the storage service. It used to fall back to a separate read and update.
