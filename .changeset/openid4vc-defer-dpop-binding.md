---
'@credo-ts/openid4vc': minor
---

`dpopRequired: 'atTokenEndpoint'` lets OpenID4VC issuers accept authorization requests without DPoP while continuing to require it at the token endpoint. DPoP proofs supplied during authorization remain validated and bind the authorization code to their key.
