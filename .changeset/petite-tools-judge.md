---
"@credo-ts/core": minor
---

Replace the hardcoded public DID method list and `publicDidMethods` configuration with sparse per-method `cacheScope` overrides on the DID module. All cache-enabled methods now default to global scope, including custom methods; configure `cacheScope: { web: 'context' }` to isolate a method's cache by agent context. Unspecified methods remain global, and an empty map does not force context scope. Resolvers retain `allowsCaching` but do not declare scope. Web, Indy, WebVH, Cheqd, and Hedera retain global caching; Key, JWK, and Peer remain uncached. Reads, writes, and invalidation use the same scope policy.

To migrate an explicit `publicDidMethods` list, set `context` overrides for cache-enabled methods that were excluded from the list. Review custom resolvers for tenant-dependent resolution, as these previously defaulted to context scope.
