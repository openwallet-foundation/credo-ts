---
"@credo-ts/openid4vc": minor
---

The holder now supports credential response encryption. Set `encryptCredentialResponse: true` when requesting credentials to ask for an encrypted credential response; it is also requested automatically when the issuer requires it. The holder creates a P-256 key for each credential request, uses `ECDH-ES` with a content encryption algorithm the issuer supports, and deletes the key once that credential is received, also when it is deferred, or when the request fails.

Credential requests are encrypted when the issuer requires it or when an encrypted response is requested from an OpenID4VCI 1.0 issuer, as the specification requires, to the first advertised key and `enc` value Credo supports.
