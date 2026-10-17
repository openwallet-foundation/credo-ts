---
'@credo-ts/core': patch
'@credo-ts/openid4vc': patch
'@credo-ts/drizzle-storage': patch
---

Handle DCQL undisclosed array elements correctly to prevent disclosing unmatched claims and preserve literal null values.

Support configuring and updating `issuerInfo` on OpenID4VCI issuers, publishing it as `issuer_info` in JSON and signed credential issuer metadata. Persist issuer information in Drizzle storage.

Bind issuance sessions and refresh token requests to the verified wallet instance key and client ID.
