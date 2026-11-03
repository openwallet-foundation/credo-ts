---
'@credo-ts/openid4vc': patch
---

The verifier's response endpoint now returns the `redirect_uri` only for the response that ends a verification session: a successful response, a wallet error response, a response that fails verification, or a response to an expired session. A response to a session that already received one gets an `Invalid session` error without the `redirect_uri`.
