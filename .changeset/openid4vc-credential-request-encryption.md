---
'@credo-ts/openid4vc': minor
---

The issuer now supports credential request encryption (OID4VCI §10). Configure `credentialRequestEncryption` with one or more public JWKs from the agent's KMS that support `ECDH-ES` (EC P-256, P-384, P-521, secp256k1 or OKP X25519, depending on the KMS backend; the `kid` must be the KMS key id) when creating or updating an issuer. The issuer advertises them in `credential_request_encryption` and decrypts (deferred) credential requests sent as a compact JWE with `Content-Type: application/jwt`. Set `required: true` to reject unencrypted requests with `invalid_encryption_parameters`. Unencrypted requests that ask for response encryption are rejected too.

Breaking: as OID4VCI §8.2 only allows response encryption on an encrypted request, `credential_response_encryption` is now only advertised when `credentialRequestEncryption` is configured. Before, every issuer advertised it. Existing issuers, including ones with `credentialResponseEncryption: { required: true }`, stop advertising response encryption until `credentialRequestEncryption` is configured, and a warning is logged for issuers that have `credentialResponseEncryption` without it. Creating or updating an issuer with `credentialResponseEncryption` but without `credentialRequestEncryption` throws.
