---
"@credo-ts/core": patch
---

fix: verify ECDSA P-521 signatures locally in CredoWebCrypto so X.509 chains with secp521r1 issuers validate on KMS backends without P-521 support (e.g. Askar)
