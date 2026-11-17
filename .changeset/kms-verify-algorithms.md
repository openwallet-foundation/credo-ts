---
'@credo-ts/core': patch
'@credo-ts/openid4vc': patch
---

The OpenID4VP verifier and the OpenID4VCI issuer now advertise the signature algorithms the agent can verify, not the ones it can sign with. Before, a backend that couldn't sign with an algorithm such as `PS256` removed it from `vp_formats_supported`, `proof_signing_alg_values_supported` and `dpop_signing_alg_values_supported`, even though the agent could still verify it. `supportedJwaSignatureAlgorithms` takes a new `operation` option for this.
