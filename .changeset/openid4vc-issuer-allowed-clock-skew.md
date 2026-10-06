---
'@credo-ts/openid4vc': patch
---

Use the agent's `validitySkewSeconds` configuration when verifying `nbf` and `exp` claims of wallet (client) attestations and Client Attestation PoP JWTs at the pushed authorization request, authorization challenge, and token endpoints. The value is also passed as the allowed clock skew for DPoP proof verification.
