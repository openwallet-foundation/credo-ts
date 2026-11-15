---
'@credo-ts/openid4vc': patch
---

The access token and credential endpoints save the issuance session once per request instead of twice. The `AccessTokenRequested` and `CredentialRequestReceived` events are still emitted, but the session in storage keeps its previous state while they are handled.

`OpenId4VcIssuerService` methods that the issuer endpoints depend on, such as `createCredentialResponse`, are now marked `@internal`. `createCredentialResponse` no longer saves the issuance session when it throws. The credential endpoint saves it instead, and only when the request changed it.

A dynamic issuance session created by a credential request is now saved once, with the credential response or in the error state, instead of also when it's created. Its creation event is emitted before it is stored.
