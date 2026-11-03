---
'@credo-ts/openid4vc': patch
---

A request to the token, credential or deferred credential endpoint for an expired issuance session is now rejected without moving the session to the `Error` state.
