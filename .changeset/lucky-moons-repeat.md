---
"@credo-ts/openid4vc": patch
---

Support configuring the signed issuer metadata signer when updating an issuer. `updateIssuerMetadata` and `updateIssuer` now accept a `metadataSigner`, which can be omitted to keep the current signer, set to a signer to enable or replace it, or set to `null` to stop signing the metadata. Previously a signer could only be configured when creating an issuer.
