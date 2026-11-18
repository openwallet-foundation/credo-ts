---
'@credo-ts/openid4vc': patch
---

The issuer stores the public key of the DPoP key it uses towards a chained authorization server in the issuance session, so the key isn't read from the key management service for every request.
