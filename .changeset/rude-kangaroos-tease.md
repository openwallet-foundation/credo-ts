---
"@credo-ts/openid4vc": patch
---

Fix an issue where `express` was being bundled in React Native applications even though the `OpenId4VcIssuerModule` and `OpenId4VcVerifierModule` were not used, causing runtime errors.
