---
'@credo-ts/openid4vc': patch
---

The issuer now supports credential request encryption (OID4VCI §10). Configure `credentialRequestEncryption.keys` with one or more keys from the agent's KMS that support `ECDH-ES` (EC P-256, P-384, P-521, secp256k1 or OKP X25519, depending on the KMS backend) when creating or updating an issuer. Pass each key as `PublicJwk.fromKmsKey(await agent.kms.createKey(...))`. The issuer advertises them in `credential_request_encryption` and decrypts (deferred) credential requests sent as a compact JWE with `Content-Type: application/jwt`. Set `required: true` to reject unencrypted requests with `invalid_encryption_parameters`. Unencrypted requests that ask for response encryption are rejected too. To rotate a key, move it to `previousKeys`. Previous keys are no longer advertised, but requests encrypted to them still decrypt.

As OID4VCI §8.2 only allows response encryption on an encrypted request, saving an issuer with `credentialResponseEncryption` but without `credentialRequestEncryption` throws. A stored issuer in that state does not advertise response encryption, and a warning is logged.
