---
'@credo-ts/core': minor
---

W3C v2 JWT and SD-JWT presentations now include `iat` and the `undefined-terms/v2` context. W3C v2 SD-JWT credentials can no longer make `issuer`, `validFrom` or `validUntil` selectively disclosable, so an issuer disclosure frame that does now throws.
