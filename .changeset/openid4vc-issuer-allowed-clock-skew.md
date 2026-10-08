---
'@credo-ts/openid4vc': patch
---

Use the agent's `validitySkewSeconds` configuration as the allowed clock skew of the OpenID4VC issuer's authorization server. It is applied when verifying the `nbf` and `exp` claims of wallet (client) attestations and Client Attestation PoP JWTs at the pushed authorization request, authorization challenge, and token endpoints, and as the allowed clock skew for DPoP proof verification. Previously a wallet whose clock was a few seconds ahead was rejected with `jwt 'nbf' is in the future`.

`@openid4vc/*` dependencies are updated to `^0.7.0`. As a result, the `credential_response_encryption` of a deferred credential request is now checked against the issuer metadata, and an invalid value is rejected with an `invalid_encryption_parameters` error response.
