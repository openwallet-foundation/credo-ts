---
'@credo-ts/core': minor
---

The default cache of the agent is now the `InMemoryLruCache` instead of the `SingleContextStorageLruCache`. The `InMemoryLruCache` works with multiple agent contexts, such as tenants, but it does not keep entries after a restart.

To keep the old behaviour, register the `CacheModule` with a `SingleContextStorageLruCache`. You need this when you update storage from version 0.4 with AnonCreds credentials that use unqualified identifiers, because the migration reads the indy namespace of the issuer from the stored cache.

```ts
new Agent({
  modules: {
    cache: new CacheModule({ cache: new SingleContextStorageLruCache({ limit: 500 }) }),
  },
})
```
