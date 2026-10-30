---
'@credo-ts/openid4vc': patch
---

Request bodies for the OpenID4VC issuer and verifier endpoints are now only parsed once the issuer or verifier is found. Requests to the base path or to an unknown issuer or verifier return a 404, where an oversized body used to return a 500.
