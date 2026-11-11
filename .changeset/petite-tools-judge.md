---
"@credo-ts/core": minor
"@credo-ts/indy-vdr": patch
"@credo-ts/webvh": patch
"@credo-ts/cheqd": patch
"@credo-ts/hedera": patch
---

Move DID cache scope defaults from core's hardcoded method list to an optional resolver cacheScope declaration. Undeclared resolvers default to context scope; Web, Indy, WebVH, Cheqd, and Hedera explicitly retain global scope. Key, JWK, Peer remain uncached. Explicit publicDidMethods lists, including an empty list, remain authoritative. The publicDidMethods getter now derives defaults from registered resolvers, and cache reads, writes, and invalidation use the same scope policy.
