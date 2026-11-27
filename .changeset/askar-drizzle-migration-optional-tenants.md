---
'@credo-ts/askar-to-drizzle-storage-migration': minor
---

`@credo-ts/tenants` is no longer a dependency, so it's only installed by agents that use multi-tenancy. The `tenantsModule` option of `AskarToDrizzleStorageMigrator.initialize` now takes a `MigratorTenantsModule`, which `TenantsModule` matches, so passing `new TenantsModule()` still works.
