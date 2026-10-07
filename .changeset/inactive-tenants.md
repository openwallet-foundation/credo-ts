---
'@credo-ts/tenants': minor
---

Add a status (active/inactive) to tenant records. Sessions can not be opened for inactive tenants, so inbound DIDComm messages and endpoints such as OpenID4VC result in an error for the tenant. Use `tenants.updateTenantStatus` to change the status, and pass `allowInactive: true` to `getTenantAgent`/`withTenantAgent` to deliberately open a session for an inactive tenant. Existing tenant records are considered active.
