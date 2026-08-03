---
"@credo-ts/openid4vc": patch
"@credo-ts/core": patch
---

fix: correctly encode kid in the header of cose signatures, and do not include the kid in oid4vci request to the issuer
