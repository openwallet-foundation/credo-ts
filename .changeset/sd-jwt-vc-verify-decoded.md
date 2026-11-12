---
'@credo-ts/core': minor
'@credo-ts/openid4vc': patch
---

The `compactSdJwtVc` option of `agent.sdJwtVc.verify` is renamed to `sdJwtVc`. Like `agent.sdJwtVc.present`, it takes the compact SD-JWT VC or an SD-JWT VC that was already decoded with `fromCompact`, which is then not decoded again. The OpenID4VP verifier uses this for the presentations it verifies.
