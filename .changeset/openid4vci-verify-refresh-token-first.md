---
'@credo-ts/openid4vc': patch
---

The token endpoint now verifies a refresh token before it loads the issuance session. An invalid refresh token is rejected with `invalid_grant` instead of a server error.
