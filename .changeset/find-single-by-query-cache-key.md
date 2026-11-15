---
'@credo-ts/core': patch
---

`Repository.findSingleByQuery` with a `cacheKey` returned a stale record after the record was updated, until the cache entry expired. It now reads the record through the cached storage service, which updates keep fresh. It also only uses the cache for records that allow caching.
