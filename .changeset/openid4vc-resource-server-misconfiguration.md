---
'@credo-ts/openid4vc': patch
---

The credential and deferred credential endpoints now answer an error that is not a rejected access token or DPoP proof, such as a misconfigured resource server, with `500 server_error` instead of `401 Unauthorized`.
