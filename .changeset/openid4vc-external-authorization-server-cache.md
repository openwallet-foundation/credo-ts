---
'@credo-ts/openid4vc': minor
---

The issuer caches the metadata and JWK Set of external authorization servers for 5 minutes, instead of fetching them on every request. A JWK Set without the access token's `kid` is fetched again, at most 3 times per 30 seconds.

```ts
new OpenId4VcModule({
  issuer: {
    // 0 disables the cache
    externalAuthorizationServerCacheExpiryInSeconds: 300,
  },
})
```
