---
'@credo-ts/openid4vc': minor
---

The issuer and verifier cache their record and tenant for 30 seconds, so endpoints no longer read storage on every request. With multiple instances, use a shared cache such as `RedisCache`. The default in-memory cache skips it.

```ts
new OpenId4VcModule({
  // false turns it off
  requestContextCache: { expiryInSeconds: 30 },
})
```

Breaking: `clientSecret` is optional on the `issuer` passed to `getDynamicIssuanceSession` and the `chainedAuthorizationServerConfig` passed to `getChainedAuthorizationRequestParameters`, as secrets are not cached.
