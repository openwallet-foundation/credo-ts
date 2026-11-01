---
'@credo-ts/openid4vc': patch
---

The credential endpoint no longer moves the issuance session to `Error` when the request fails with `invalid_proof` or `invalid_nonce`, so the wallet can retry with a new proof.
