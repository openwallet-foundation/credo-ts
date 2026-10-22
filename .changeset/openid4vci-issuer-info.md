---
'@credo-ts/openid4vc': patch
'@credo-ts/drizzle-storage': patch
---

Add `issuerInfo` to `createIssuer` and `updateIssuerMetadata`, published as `issuer_info` (ETSI TS 119 472-3) in the JSON and signed credential issuer metadata. The `Openid4vcIssuer` table gets an `issuer_info` column, so make sure to run the migrations for the `openid4vc` bundle.
