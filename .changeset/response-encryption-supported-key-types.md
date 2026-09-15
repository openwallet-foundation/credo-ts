---
"@credo-ts/openid4vc": patch
"@credo-ts/askar": patch
"@credo-ts/node": patch
---

Only pick a response encryption key from `client_metadata.jwks` that the key management backends of the agent can actually perform the `ECDH-ES` key agreement with. Previously the first recognized `enc` key was used, which failed later on if e.g. a verifier included a `P-521` key and the configured KMS backend (such as Askar) does not support that curve. The Askar and Node key management backends now also take the curve of the external public key into account in `isOperationSupported`.
