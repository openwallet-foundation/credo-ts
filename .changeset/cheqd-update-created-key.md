---
'@credo-ts/cheqd': patch
---

Updating a did:cheqd with `createKey` or `keyId` now adds the verification method for that key to the DID document. Before, it was left out of the document and the key was dropped from the DID record. A DID record without `keys` now also keeps the key.
