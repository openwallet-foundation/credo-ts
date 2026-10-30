---
'@credo-ts/openid4vc': patch
---

Return a 413 instead of a 500 when a request body that is too large is sent to the issuer or verifier base path without an issuer or verifier id.
