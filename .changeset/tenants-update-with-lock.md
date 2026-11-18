---
'@credo-ts/tenants': patch
---

Add `updateTenantByIdWithLock` to the tenants API, which updates a tenant record while holding a lock on it on storage backends that support locking.
