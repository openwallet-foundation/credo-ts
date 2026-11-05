---
'@credo-ts/core': minor
---

Remove `sov` from the default `publicDidMethods` of the DIDs module config, and remove the `legacyUnqualifiedDid` tag from `DidRecord`. The `_internal/legacyDid` metadata that storage migrations write is unchanged.
