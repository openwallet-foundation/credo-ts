---
"@credo-ts/openid4vc": minor
---

The holder now supports credential response encryption. Set `encryptCredentialResponse: true` when requesting credentials to ask for an encrypted credential response; it is also requested automatically when the issuer requires it. The holder creates a P-256 key for the response, uses `ECDH-ES` with a content encryption algorithm the issuer supports, and deletes the key once all credentials of the request, including deferred ones, are received.

Credential requests are encrypted when the issuer requires it or when an encrypted response is requested from an OpenID4VCI 1.0 issuer, as the specification requires.
