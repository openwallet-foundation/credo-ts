---
"@credo-ts/openid4vc": minor
---

The holder now supports credential response encryption. Set `credentialResponseEncryption` when requesting credentials to ask for an encrypted credential response: with `'required'` the request fails when the issuer and Credo have no encryption algorithms or request encryption key in common, with `'preferred'` the response is then not encrypted. It is also requested automatically when the issuer requires it. The holder creates a P-256 key for each credential request, uses `ECDH-ES` with a content encryption algorithm the issuer supports, and deletes the key once the response is received or the request fails. Deferred credential requests to an OpenID4VCI 1.0 issuer use a new key for each request. Pass the `credentialResponseEncryption` value of the deferred credential on when retrieving it. Before OpenID4VCI 1.0 the deferred credential response can't be encrypted, so retrieving it fails with `'required'`.

Credential requests are encrypted when the issuer requires it or when an encrypted response is requested from an OpenID4VCI 1.0 issuer, as the specification requires, to the first advertised key and `enc` value Credo supports.
