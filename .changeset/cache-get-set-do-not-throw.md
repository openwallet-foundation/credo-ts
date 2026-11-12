---
'@credo-ts/core': patch
'@credo-ts/redis-cache': patch
---

`RedisCache` and `SingleContextStorageLruCache` no longer throw from `get` and `set` when the cache can't be reached. `get` returns `null`, `set` does nothing, and both log a warning. This keeps the agent working from storage during a cache outage. `remove` still throws, as the entry would otherwise stay in the cache.
