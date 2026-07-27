---
"@credo-ts/core": patch
---

Use the `alg` from the provided options when updating a JWT token status list, instead of the `alg` of the signing key jwk (which is usually not defined).
