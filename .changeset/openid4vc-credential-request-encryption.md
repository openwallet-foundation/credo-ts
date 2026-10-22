---
'@credo-ts/openid4vc': patch
'@credo-ts/drizzle-storage': patch
---

The issuer now supports credential request encryption (OID4VCI §10). Configure `credentialRequestEncryption` with one or more P-256 public JWKs from the agent's KMS when creating or updating an issuer, and the issuer advertises them in `credential_request_encryption` and decrypts (deferred) credential requests sent as a compact JWE with `Content-Type: application/jwt`. Set `required: true` to reject unencrypted requests with `invalid_encryption_parameters`.

When the issuer has a `metadataSigner`, the authorization server metadata is now also returned as a signed JWT when requested with `Accept: application/jwt`, as the swiyu wallet requires.

The drizzle storage stores the issuer's `credentialRequestEncryption` configuration in a new `credential_request_encryption` column; run the drizzle migrations when upgrading.
