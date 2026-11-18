---
'@credo-ts/openid4vc': minor
---

A credential request that fails with `invalid_nonce` no longer moves the issuance session to `Error`, so the wallet can get a new nonce from the nonce endpoint and retry. From draft 15 on, `invalid_proof` fails the session, and the token response and credential error responses no longer include a `c_nonce`. A credential request on a failed session returns `credential_request_denied` and keeps the error message of the session.

OpenID4VCI drafts 11 to 14 have no nonce endpoint and no `invalid_nonce` error. For these, the token response keeps its `c_nonce`, `invalid_proof` keeps the session open, and a missing or invalid nonce returns `invalid_proof` with the `c_nonce` to retry with.

The draft is the `version` the credential offer was created with, which defaults to `v1`. A wallet on draft 11 to 14 only gets a `c_nonce` when the offer was created with `version: 'v1.draft11-14'`.
