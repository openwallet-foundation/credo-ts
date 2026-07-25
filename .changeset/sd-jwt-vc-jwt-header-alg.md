---
"@credo-ts/core": patch
---

Use the JWT header `alg` for SD-JWT VC signing and verification instead of always falling back to the first supported signature algorithm of the key. The `alg` can now be set on a `PublicJwk` instance, restricting the key to that algorithm.
