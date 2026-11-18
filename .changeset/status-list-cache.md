---
'@credo-ts/core': minor
---

The status list of an SD-JWT VC, and the status list and identifier list of an mdoc, are now cached in the agent cache once verified, instead of fetched for every verification. A list is cached for as long as its `ttl` and `exp` claims allow, up to 5 minutes, and not at all when it has neither claim. In that time a credential that was revoked after the status list was fetched still verifies. Set the maximum with `statusListCacheExpirySeconds` in the `TokenStatusListModule` config, where 0 fetches the lists for every verification.
