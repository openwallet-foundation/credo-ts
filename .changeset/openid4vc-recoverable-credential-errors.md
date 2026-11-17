---
'@credo-ts/openid4vc': minor
---

A credential request that fails with `invalid_nonce` no longer moves the issuance session to `Error`, so the wallet can get a new nonce from the nonce endpoint and retry. For OpenID4VCI drafts 11 to 14, which have no nonce endpoint, `invalid_proof` also keeps the session open and the error carries the `c_nonce` to retry with. From draft 15 on, `invalid_proof` fails the session and credential error responses no longer include a `c_nonce`.
