---
'@credo-ts/openid4vc': minor
---

Rotating the issuer's access token signing key keeps the previous key, so access tokens, refresh tokens and nonces it signed still verify. Delete the previous keys with `deletePreviousAccessTokenSigningKeys` once their tokens have expired, or pass `keyIds` to delete only those keys. Access tokens now carry a `kid` header instead of a `jwk` header, and the JWKS endpoint publishes the current and previous keys. Access tokens issued before this have no `kid`, so they stop verifying when the key is rotated. Rotate once they have expired.

The `kid` of access tokens, refresh tokens, nonces, client attestation challenges and JWKS keys is now the JWK thumbprint of the key instead of its KMS key id. Refresh tokens that carry the KMS key id as `kid` still verify.
