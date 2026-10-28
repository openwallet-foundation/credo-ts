---
'@credo-ts/core': patch
---

Verifying a W3C VC 2.0 Data Integrity credential now checks that its issuer is trusted, using `trustedIssuers` or the `getTrustedIssuersForVerification` callback. Verifying a VC 2.0 presentation now also passes `trustedIssuers` to the credentials it contains.
