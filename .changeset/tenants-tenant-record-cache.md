---
'@credo-ts/tenants': minor
---

The id, status and storage version of the tenant record, which are read every time a tenant session is opened, now come from the cache of the agent's `CacheModule`, with an expiry of 30 seconds. The rest of the record is not cached. The new `tenantRecordCache` option of the tenants module config changes the expiry, or turns the cache off with `false`.

```ts
new TenantsModule({
  tenantRecordCache: { expiryInSeconds: 60 },
})
```

When running multiple instances, use a cache that is shared between them, such as `RedisCache` from `@credo-ts/redis-cache`. A tenant that is deactivated, deleted or updated is removed from the cache, so with a shared cache the change takes effect on every instance at once. With a cache per instance, such as `InMemoryLruCache`, the other instances keep opening sessions for a deactivated or deleted tenant until the entry expires.

The cache is not used when the agent's cache is the `SingleContextStorageLruCache`, which is the default when no `CacheModule` is registered. A warning is logged once in that case.
