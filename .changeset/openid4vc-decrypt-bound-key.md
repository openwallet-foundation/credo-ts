---
'@credo-ts/openid4vc': patch
---

Credo now only decrypts an OpenID4VC JWE with the key bound to the session or request. Before, it used the `kid` from the JWE header when no key was bound, so the sender could choose any key in the KMS to decrypt with. A verifier now rejects an encrypted authorization response whose `kid` isn't in the request's `client_metadata.jwks`. The wallet now rejects encrypted request objects and encrypted credential responses, as it never provides an encryption key for either.
