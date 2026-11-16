---
'@credo-ts/core': patch
'@credo-ts/askar': patch
'@credo-ts/tenants': patch
---

Add `Repository.deleteByQuery` to delete all records that match a query and return how many were deleted. It uses the new optional `StorageService.deleteByQuery` when the storage service implements it, which Askar does with a single bulk delete. Other storage services fall back to finding the records and deleting them one by one. It emits one `RecordsDeletedByQuery` event with the record type, query and number of deleted records, and no `RecordDeleted` event per record.

Deleting a tenant now deletes its tenant routing records with `deleteByQuery`, without loading them first.
