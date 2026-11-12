---
'@credo-ts/core': patch
---

The agent now logs a warning when it uses the default cache. The default cache will change from the `SingleContextStorageLruCache` to the `InMemoryLruCache` in a future version. To keep using the `SingleContextStorageLruCache`, register the `CacheModule` with it explicitly.

```ts
new Agent({
  modules: {
    cache: new CacheModule({ cache: new SingleContextStorageLruCache({ limit: 500 }) }),
  },
})
```
