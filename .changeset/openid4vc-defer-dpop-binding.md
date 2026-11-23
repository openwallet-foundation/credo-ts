---
'@credo-ts/openid4vc': minor
---

DPoP now defaults to token endpoint enforcement, allowing authorization requests without DPoP while requiring it at the token endpoint. Configure `dpopRequired: true` to require DPoP during authorization as well. The same policy is available per issuance session through `authorization.requireDpop` and dynamic-session `requireDpop`. DPoP proofs supplied during authorization remain validated and bind the authorization code to their key.
