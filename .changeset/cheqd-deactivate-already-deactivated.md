---
'@credo-ts/cheqd': patch
---

Deactivating a did:cheqd that is already deactivated on the ledger now succeeds and marks the DID record as deactivated. Before, it failed with `Did not found`.
