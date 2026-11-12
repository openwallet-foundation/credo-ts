---
'@credo-ts/core': minor
---

`KeyManagementApi.getPublicKey` now returns the backend that holds the key with the public key. This is a breaking change, the public key was returned directly before. Pass the backend to the operations that follow on the same key to skip looking up its backend.

```ts
const { publicKey, backend } = await agent.kms.getPublicKey({ keyId })
await agent.kms.sign({ keyId, backend, algorithm: 'ES256', data })
```
