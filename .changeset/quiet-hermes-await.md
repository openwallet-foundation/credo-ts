---
'@credo-ts/openid4vc': patch
---

Avoid `await` inside an object literal in a conditional expression, which Hermes (React Native) can evaluate to the wrong value. This broke credential requests with multiple did urls on the holder side, and the `cnf.jkt` of DPoP-bound refresh tokens on the issuer side.

Also expose the compact JWT of a signed authorization request as `signedAuthorizationRequest.compact` when resolving an OpenID4VP authorization request.
