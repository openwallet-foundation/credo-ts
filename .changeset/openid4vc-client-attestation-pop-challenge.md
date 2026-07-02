---
"@credo-ts/openid4vc": patch
---

feat(openid4vc): support the Client Attestation PoP challenge (nonce) from draft 09 of OAuth 2.0 Attestation-Based Client Authentication

The issuer now exposes a `challenge_endpoint` and can require a fresh, server-issued `challenge` inside the Client Attestation PoP JWT (enabled through the new `clientAttestationPopNonceRequired` issuer config option, which advertises `client_attestation_pop_nonce_required` in the authorization server metadata). When enabled, the challenge is enforced at the pushed authorization request, authorization challenge and token endpoints. The holder automatically fetches a challenge from the authorization server's `challenge_endpoint` and includes it in the Client Attestation PoP JWT when the authorization server requires it.
