---
'@credo-ts/openid4vc': patch
---

The credential endpoint now responds with `unknown_credential_identifier` (OpenID4VCI 1.0 §8.3.1) instead of `invalid_credential_request` when a credential request contains a `credential_identifier`, since Credo never grants credential identifiers.
