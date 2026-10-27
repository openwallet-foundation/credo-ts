---
'@credo-ts/openid4vc': patch
'@credo-ts/drizzle-storage': patch
---

The issuer now supports credential request encryption (OID4VCI §10). Configure `credentialRequestEncryption` with one or more P-256 public JWKs from the agent's KMS (the `kid` must be the KMS key id) when creating or updating an issuer. The issuer advertises them in `credential_request_encryption` and decrypts (deferred) credential requests sent as a compact JWE with `Content-Type: application/jwt`. Set `required: true` to reject unencrypted requests with `invalid_encryption_parameters`. Unencrypted requests that ask for response encryption are rejected too.

As OID4VCI §8.2 only allows response encryption on an encrypted request, `credential_response_encryption` is now only advertised when `credentialRequestEncryption` is configured, and configuring `credentialResponseEncryption` without it throws.

The drizzle storage stores the issuer's `credentialRequestEncryption` configuration in a new `credential_request_encryption` column; run the drizzle migrations when upgrading.
