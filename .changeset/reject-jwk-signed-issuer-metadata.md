---
'@credo-ts/openid4vc': minor
---

The issuer's `metadataSigner` now only accepts `x5c` and `did` signers. Signed credential issuer metadata (`openidvci-issuer-metadata+jwt`) can no longer be signed with a `jwk` header, as wallets can't establish trust in a bare key.
