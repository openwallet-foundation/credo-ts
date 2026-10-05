---
'@credo-ts/openid4vc': patch
---

The verifier's response endpoint now answers an OpenID4VP Authorization Error Response (e.g. `error=access_denied`, plain or encrypted) with HTTP 200 and the `redirect_uri` when one is set, as required by OpenID4VP 1.0 §8.2, instead of a 500. The verification session still moves to `Error`, with the wallet's `error` and `error_description` in `errorMessage`.
