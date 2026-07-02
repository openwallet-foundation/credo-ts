---
"@credo-ts/openid4vc": patch
---

fix(openid4vc): preserve omitted optional issuer metadata fields while allowing explicit clearing

`updateIssuerMetadata` now applies optional metadata fields based on key presence instead of value checks. Omitting a key keeps the existing value, while explicitly providing `undefined` clears that value.
