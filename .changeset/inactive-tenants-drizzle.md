---
'@credo-ts/drizzle-storage': patch
---

Add a `status` column to the `Tenant` table for the new tenant status (active/inactive) feature. Make sure to run the migrations for the `tenants` bundle, existing tenants are set to active.
