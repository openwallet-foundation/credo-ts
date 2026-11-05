---
'@credo-ts/openid4vc': minor
---

Refresh tokens are now always bound to the wallet's DPoP key, and creating an issuance session with `generateRefreshTokens` throws when DPoP isn't required.

Refresh tokens can now be enabled for all issuance sessions with `generateRefreshTokens` in the issuer module config (default `false`).

This follows RFC 9700 section 2.2.2, which requires refresh tokens for public clients such as wallets to be sender-constrained or rotated.
