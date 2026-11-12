---
'@credo-ts/core': patch
---

Replaced the unmaintained `lru_map` dependency with `lru-cache`. The new `LruCache` class wraps it, and `InMemoryLruCache` and `SingleContextStorageLruCache` use that class. The `limit` of these caches must now be 0 or a positive integer, where 0 keeps nothing. A limit of `Infinity` was accepted before and now throws.
