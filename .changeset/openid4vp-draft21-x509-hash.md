---
'@credo-ts/openid4vc': patch
---

Creating an OpenID4VP `v1.draft21` authorization request with the `x509_hash` client id prefix now throws. Draft 21 signals the prefix through `client_id_scheme`, which has no `x509_hash` value (it was added in draft 25), so such a request was created but could not be parsed back and every response to it failed. Use `x509_san_dns`, or version `v1`.
