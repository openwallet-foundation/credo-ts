---
'@credo-ts/openid4vc': patch
---

The OpenID4VCI holder now accepts an SD-JWT VC that the issuer bound to the key of the DID used for credential binding (`cnf.jwk`, for example with `did:jwk`), instead of rejecting it with "Missing kmsKeyId". The key ids of the DIDs in the credential request are now linked to the received credential, the same way as with JWK binding.
