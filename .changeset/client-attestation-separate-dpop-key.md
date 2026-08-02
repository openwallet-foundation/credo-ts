---
"@credo-ts/openid4vc": patch
---

Don't require the DPoP proof to use the client attestation confirmation key at the pushed authorization request and authorization challenge endpoints. Per the attestation-based client authentication draft, the DPoP key and the client instance key only have to be the same for the `attest_jwt_client_auth_dpop` method (DPoP combined mode), where a single DPoP proof replaces the client attestation PoP JWT. When the dedicated `OAuth-Client-Attestation-PoP` header is present, the DPoP proof is validated according to RFC 9449 independently, and its public key is not required to match the `cnf` claim of the client attestation. The issuer wrongly enforced key equality for both methods, rejecting interoperable wallets that use a separate DPoP key. Key equality for the DPoP-bound method at the token endpoint is unaffected.
