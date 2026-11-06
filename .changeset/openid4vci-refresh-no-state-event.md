---
'@credo-ts/openid4vc': patch
---

Refreshing an access token no longer emits an issuance session state changed event, as the session state doesn't change.
