---
'@credo-ts/openid4vc': patch
---

Align OpenID4VCI issuer endpoint responses with the specs. A credential request that fails parsing (e.g. an unknown `credential_configuration_id`) now returns an OAuth2 error response instead of an unhandled `500`. Missing or invalid authentication now responds with `401` instead of `403` (RFC 9110, RFC 6750), a successful pushed authorization request responds with `201 Created` (RFC 9126), and the authorization server metadata now includes `response_types_supported: ["code"]` (RFC 8414).
