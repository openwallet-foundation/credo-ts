---
"@credo-ts/openid4vc": patch
---

Allow selecting and persisting the KMS backend used for OpenID4VC issuer access-token signing keys. Key rotation defaults to the issuer's current backend, supports moving to another backend, and deletes the previous key through its owning backend. Existing issuers continue to use the default KMS backend.
