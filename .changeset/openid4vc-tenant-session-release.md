---
'@credo-ts/openid4vc': patch
---

Fix tenant sessions not being released for some OpenID4VC requests. Requests for signed issuer metadata, and requests to the authorization and redirect endpoints used for chained identity, left the tenant session open. Unauthenticated requests could use this to exhaust the tenant session limit and block all tenants. The session is now always ended once the response is sent.
