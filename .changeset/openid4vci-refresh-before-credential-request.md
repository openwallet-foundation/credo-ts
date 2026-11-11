---
'@credo-ts/openid4vc': patch
---

Refresh tokens can now be used before the first credential request. Before, the issuer rejected a refresh in the `AccessTokenCreated` state with `invalid_grant`.
