---
'@credo-ts/core': patch
'@credo-ts/openid4vc': patch
---

The `trustedIssuers` option for verifying W3C credentials and presentations now also accepts a callback that resolves the trusted issuers for each credential. OpenID4VP verification uses it to apply the trust callback's result to that credential only. Before, the trusted issuers of all credentials in a W3C presentation were merged and applied to each credential.
