---
'@credo-ts/webvh': patch
---

The did:webvh registrar signs an update with the active update key, wherever its verification method is in the updated DID document. It used the first verification method with a `publicKeyMultibase`, so an update that listed another key first failed. An updated DID document also no longer needs a verification method with a `publicKeyMultibase`.
