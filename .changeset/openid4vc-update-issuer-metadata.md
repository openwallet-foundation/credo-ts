---
"@credo-ts/openid4vc": patch
---

Only update the issuer metadata that is provided to `updateIssuerMetadata`. Optional metadata can now be omitted to keep the current value, set to a value to replace it, or set to `null` to remove it. Previously omitting metadata removed it from the issuer record.
