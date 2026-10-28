---
'@credo-ts/core': patch
---

DID resolution now returns an `invalidDidDocument` error when the id of the resolved DID document does not match the resolved DID.
