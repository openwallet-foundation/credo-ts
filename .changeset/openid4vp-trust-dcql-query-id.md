---
'@credo-ts/openid4vc': patch
'@credo-ts/core': patch
---

The `openId4VpCredential` verification passed to `getTrustedIssuersForVerification` now includes `dcql`: the DCQL query and the id of the credential query the credential was presented for. Decide trust on the query, not on the credential's `vct`. A query also matches an SD-JWT VC whose type metadata extends a requested `vct`, and any issuer can publish such type metadata.

When the verifier resolved the type metadata to match the query, the SD-JWT VC has it as `typeMetadata` and `typeMetadataChain`. The `ResponseVerified` state change event now includes the verified response (`verifiedAuthorizationResponse`), so it doesn't have to be loaded again with `getVerifiedAuthorizationResponse`, which resolves the type metadata again. `@sd-jwt/sd-jwt-vc` is updated to 0.23.1, which rejects type metadata that describes a different `vct` than the one it was resolved for.
