---
'@credo-ts/openid4vc': patch
---

The OpenID4VC issuer and verifier endpoints now return an `invalid_request` error with a 4xx status instead of a 500 `server_error` for malformed requests, such as a request body the body parser rejects (for example invalid JSON or an unsupported charset), an authorization response without a body or with a `response` that isn't a valid JWT, and an encrypted authorization response with an unsupported `alg` or `enc` or with content that can't be parsed.

The JWE decrypt callback, which the holder also uses, now treats an unsupported `alg` or `enc` as a failed decryption instead of throwing an error.
