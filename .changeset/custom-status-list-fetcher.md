---
'@credo-ts/core': patch
---

Added a `customStatusListFetcher` option to the SD-JWT VC module. It replaces the HTTP GET with which the agent fetches the status list JWT that the `status.status_list.uri` claim of a presented SD-JWT VC references, in the same way `customTypeMetadataResolver` replaces the fetch of Type Metadata. The option receives the `uri` and a `defaultFetcher`, so a verifier can apply a network policy to the fetch (HTTPS only, no redirects, an address allowlist, a response size bound) or serve the status list JWT from a cache, and fall back to the default fetch where it wants to.

`@credo-ts/core` now exports `SdJwtVcModuleConfig`, `SdJwtVcModuleConfigOptions`, and the types of the `customStatusListFetcher` and `customTypeMetadataResolver` options.

The agent now also rejects a status list JWT whose JOSE header `typ` is not `statuslist+jwt`, as Token Status List requires of a relying party. This check runs before the signature of the status list JWT is verified, whichever fetcher returned it.
