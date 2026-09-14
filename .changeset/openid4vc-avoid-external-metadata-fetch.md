---
'@credo-ts/openid4vc': patch
---

Avoid an unnecessary request to the agent's own JWKs endpoint when verifying OpenID4VCI access tokens.

When an access token issued by the agent's own built-in authorization server is verified, the agent no longer performs an HTTP request to its own `jwks_uri` to retrieve the access token signing key. The key is already held in the issuer record, and is now resolved locally.
