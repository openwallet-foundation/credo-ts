---
'@credo-ts/core': patch
---

With `useCachedStorageService`, updating a record now removes it from the cache instead of writing the new version, so two updates that reach the cache out of order can no longer leave the older version in it. Deleting a record now removes it from the cache after deleting it from storage, instead of before.
