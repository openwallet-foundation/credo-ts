---
'@credo-ts/openid4vc': minor
---

Reject signed credential issuer metadata (`openidvci-issuer-metadata+jwt`) signed with a `jwk` header. A `jwk` signer can't be checked against the trusted issuers, so anyone who controls the metadata response could sign it and the holder treated it as signed. Signed issuer metadata must be signed with `x5c` or `did`. The issuer's `metadataSigner` now only accepts `x5c` and `did` signers.
