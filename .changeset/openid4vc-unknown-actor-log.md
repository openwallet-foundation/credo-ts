---
'@credo-ts/openid4vc': patch
---

A request for an issuer or verifier id that does not exist is logged as a warning instead of an error. It still returns a 404. Other failures to resolve the issuer or verifier are still logged as errors.
