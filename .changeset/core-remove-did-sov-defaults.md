---
'@credo-ts/core': minor
---

Remove `sov` from the default `publicDidMethods` of the DIDs module config. `DidRecord` no longer sets the `legacyUnqualifiedDid` tag. Existing records keep the tag in storage, but Credo does not use it. The `_internal/legacyDid` metadata that storage migrations write is unchanged.
