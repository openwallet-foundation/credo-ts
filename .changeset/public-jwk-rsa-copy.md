---
'@credo-ts/core': patch
---

`PublicJwk.fromUnknown` copies an RSA jwk like it does other key types, so setting `keyId` no longer changes the jwk that was passed in.
