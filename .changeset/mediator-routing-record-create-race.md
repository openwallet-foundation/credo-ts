---
'@credo-ts/core': patch
'@credo-ts/didcomm': patch
---

`Repository.updateByIdWithLock` now stores the record returned by the callback when the storage service has no lock, instead of the record it read. When two mediator instances create the routing record at the same time, the instance that loses now deletes the routing keys it created instead of leaving them in the KMS.
