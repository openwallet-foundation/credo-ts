---
'@credo-ts/openid4vc': patch
---

The issuer's pushed authorization request endpoint now answers a request without `redirect_uri` with `invalid_request` instead of `invalid_scope`, as required by RFC 6749 §4.1.2.1 and RFC 9126 §2.3. This matches the error already returned for a `redirect_uri` that is not allowed.
