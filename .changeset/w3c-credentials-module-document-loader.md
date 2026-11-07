---
'@credo-ts/core': minor
---

Remove the deprecated `documentLoader` option of the `W3cCredentialsModule`, and the `W3cCredentialsModuleConfig`. The `JsonLdModule` is now a default module. Configure the document loader on it instead:

```ts
const agent = new Agent({
  modules: {
    jsonLd: new JsonLdModule({ documentLoader }),
  },
})
```
