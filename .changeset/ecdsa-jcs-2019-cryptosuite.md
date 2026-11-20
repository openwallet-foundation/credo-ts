---
'@credo-ts/core': patch
---

Added the `ecdsa-jcs-2019` Data Integrity cryptosuite from VC Data Integrity ECDSA Cryptosuites v1.0, for P-256 and P-384 keys. The `W3cDataIntegrityModule` registers it by default next to `eddsa-jcs-2022`, so Data Integrity proofs can now be created and verified with P-256 and P-384 keys. Issuing a VC Data Model 2.0 credential with the DIDComm Data Integrity credential format (RFC 0809) now works with a P-256 or P-384 issuer key, and selects `ecdsa-jcs-2019` when no cryptosuite is given. Ed25519 keys still use `eddsa-jcs-2022`.
