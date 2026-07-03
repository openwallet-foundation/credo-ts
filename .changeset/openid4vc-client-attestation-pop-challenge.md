---
"@credo-ts/openid4vc": patch
"@credo-ts/drizzle-storage": patch
---

feat(openid4vc): support the Client Attestation PoP challenge and DPoP-bound method (draft 09 of OAuth 2.0 Attestation-Based Client Authentication)

- The issuer can require a fresh, server-issued client attestation PoP `challenge` (enabled through the new `clientAttestationPopChallengeRequired` issuer config option). When enabled it advertises a `challenge_endpoint` and, at the token endpoint, uses the reactive `use_attestation_challenge` flow (returning the challenge in the `OAuth-Client-Attestation-Challenge` header) so clients retry automatically. The holder additionally fetches a challenge proactively from the `challenge_endpoint` for the pushed authorization request and authorization challenge endpoints.
- Support for the DPoP-bound client attestation method (`attest_jwt_client_auth_dpop`), where a single DPoP proof signed with the client instance key serves as both the DPoP proof and the client attestation PoP. Used automatically in the pre-authorized code flow when the authorization server advertises it.
- The issuer now advertises the new `client_attestation_signing_alg_values_supported` / `client_attestation_pop_signing_alg_values_supported` metadata (configurable per issuer, stored as two nullable columns on the issuer record). Client attestation client authentication is advertised in `token_endpoint_auth_methods_supported` based on those signing algorithms being configured (matching how DPoP support is enabled via `dpop_signing_alg_values_supported`): `attest_jwt_client_auth` when the client attestation and pop signing algs are set, and the DPoP-bound `attest_jwt_client_auth_dpop` when the client attestation and DPoP signing algs are set.
