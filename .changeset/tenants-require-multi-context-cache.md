---
'@credo-ts/tenants': minor
---

Breaking: an agent with the tenants module throws on initialize when its cache is the `SingleContextStorageLruCache`, which is the default when no `CacheModule` is registered. That cache only supports one agent context and failed once a second tenant used it. Register the `CacheModule` with another cache.

```ts
new Agent({
  modules: {
    tenants: new TenantsModule(),
    cache: new CacheModule({ cache: new InMemoryLruCache({ limit: 500 }) }),
  },
})
```
