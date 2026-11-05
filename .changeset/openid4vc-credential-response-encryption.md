---
'@credo-ts/openid4vc': patch
'@credo-ts/drizzle-storage': patch
---

The issuer now supports credential response encryption (OID4VCI §8.3). When a wallet includes `credential_response_encryption` in its credential or deferred credential request, the issuer encrypts the response body as a compact JWE and returns it with `Content-Type: application/jwt`. Requests without encryption continue to work unchanged.

The issuer metadata advertises `credential_response_encryption` when credential request encryption is configured (see `credentialRequestEncryption`), as OID4VCI §8.2 requires an encrypted credential request when response encryption is used. By default encryption is optional and all algorithms supported by Credo are listed (`alg_values_supported: ["ECDH-ES"]`, `enc_values_supported: ["A128GCM", "A256GCM", "A128CBC-HS256"]`). Use the new `credentialResponseEncryption` option when creating or updating an issuer to require encryption or restrict the supported `alg` and `enc` values. Requests that omit required encryption or use an unsupported `alg` or `enc` are rejected with `invalid_encryption_parameters`.

The drizzle storage stores the issuer's `credentialResponseEncryption` configuration in a new `credential_response_encryption` column; run the drizzle migrations when upgrading.
