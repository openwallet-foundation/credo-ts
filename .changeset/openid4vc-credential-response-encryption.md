---
'@credo-ts/openid4vc': patch
---

The issuer now supports credential response encryption (OID4VCI §8.3). When a wallet includes `credential_response_encryption` in its credential or deferred credential request, the issuer encrypts the response body as a compact JWE and returns it with `Content-Type: application/jwt`. Requests without encryption continue to work unchanged.

The issuer metadata now advertises `credential_response_encryption` with `alg_values_supported: ["ECDH-ES"]`, `enc_values_supported: ["A128GCM", "A256GCM", "A128CBC-HS256"]`, and `encryption_required: false`.
