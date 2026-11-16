---
'@credo-ts/core': patch
'@credo-ts/redis-cache': patch
---

`RedisCache` and `SingleContextStorageLruCache` no longer throw when the cache can't be reached. `get` returns `null` and `set` does nothing, and both log a warning. `remove` does nothing and logs an error, as the entry can be served outdated until it expires. This keeps the agent working from storage during a cache outage. Before, deleting a cached record, or updating or deactivating a DID, failed. A custom `Cache` should not throw either, as a cache is optional and must not fail the flow that uses it.
