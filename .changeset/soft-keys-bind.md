---
'@credo-ts/core': patch
---

SD-JWT VC issuance now includes only the public key fields needed to calculate a thumbprint in `cnf.jwk`. Previously, the holder key's local `kid` could be copied into the signed credential and sent to the verifier. Credentials that already contain `cnf.jwk.kid` remain supported for presentation and verification.

For a DID-selected holder key, `cnf: 'jwk'` opts into embedding its public JWK instead of binding the credential to the DID. The existing DID-bound `cnf.kid` form remains the default. Holder verification methods can be resolved from either `authentication` or `assertionMethod`, and DID-bound presentation requires a locally registered signing key.
