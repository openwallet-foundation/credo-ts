---
'@credo-ts/core': minor
'@credo-ts/askar': minor
'@credo-ts/node': minor
---

KMS `encrypt` can now wrap the content key for more than one recipient. `ECDH-ES+A128KW`, `ECDH-ES+A192KW`, `ECDH-ES+A256KW` and the new `ECDH-1PU+A256KW` take a `recipients` array instead of `externalPublicJwk`, and return `encryptedKeys` in the same order. All recipients must use the same key type and curve, since they share one ephemeral key. The single `encryptedKey` is removed from the result.

The Askar and Node backends support `ECDH-1PU+A256KW`, which needs an `A*CBC-HS*` content encryption algorithm in both `encrypt` and `decrypt`. `supportedBackendsForOperation` returns no backends for content encryption that `encrypt` or `decrypt` rejects.

```ts
const { encrypted, iv, tag, ephemeralPublicJwk, encryptedKeys } = await agent.kms.encrypt({
  key: {
    keyAgreement: {
      algorithm: 'ECDH-1PU+A256KW',
      keyId: senderKeyId,
      recipients: [{ externalPublicJwk: aliceJwk }, { externalPublicJwk: bobJwk }],
    },
  },
  encryption: { algorithm: 'A256CBC-HS512' },
  data,
})
```
