---
'@credo-ts/openid4vc': patch
---

OpenID4VP response encryption no longer creates, stores and deletes a KMS key for every response. The `epk` in the JWE header no longer has a `kid`.
