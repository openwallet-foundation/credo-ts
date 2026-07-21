---
"@credo-ts/core": minor
"@credo-ts/redis-cache": minor
"@credo-ts/anoncreds": minor
---

feat: the `Cache` interface `get`, `set` and `remove` methods now accept a `CacheOptions` parameter with a `scope` that is either `'context'` (default) or `'global'`, allowing globally reusable data to be shared across agent contexts. The X.509 CRL summary cache, the Indy VDR pool lookup cache and the AnonCreds registry cache use the global scope, as they only hold publicly anchored data. The DID resolver caches documents of public did methods in the global scope, and documents of other did methods per agent context; the list of public did methods can be configured with the new `publicDidMethods` option of the dids module (default `['web', 'indy', 'sov', 'cheqd', 'hedera', 'webvh']`).

Behavior changes to be aware of:

- `InMemoryLruCache` now namespaces keys by `contextCorrelationId` by default. This fixes potential cross-context sharing of context-scoped entries (e.g. records cached by `CachedStorageService`) in multi-tenant setups. Single-context agents are not affected.
- `RedisCache` stores global-scope entries under a `global:` key prefix. Existing context-scoped Redis entries for the caches that moved to the global scope become cache misses after upgrading and expire through their TTL, causing a one-time refetch.
