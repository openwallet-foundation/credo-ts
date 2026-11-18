---
'@credo-ts/core': patch
'@credo-ts/tenants': patch
---

Default agent modules can now be configured by passing their config options instead of a module instance. Module instances still work. Other modules must still be passed as a module instance.

```ts
const agent = new Agent({
  dependencies: agentDependencies,
  modules: {
    dids: { resolvers: [new WebDidResolver()] },
    x509: { trustedCertificates: [certificate] },
    askar: new AskarModule({ askar, store }),
  },
})
```
