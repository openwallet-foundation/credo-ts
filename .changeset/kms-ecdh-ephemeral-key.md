---
'@credo-ts/core': minor
'@credo-ts/askar': minor
'@credo-ts/node': minor
---

The KMS now creates the ECDH ephemeral key itself and never stores it. `encrypt` returns its public key as `ephemeralPublicJwk`. `ECDH-ES` and `ECDH-ES+KW` no longer take a `keyId`, and passing one now fails validation. In `encrypt`, a `keyId` in `keyAgreement` now always means the sender's key.

`encryption.aad` can now be a callback that gets the `ephemeralPublicJwk` and returns the AAD, so you can put the `epk` in a JWE protected header. This is only allowed with `ECDH-ES`, `ECDH-ES+KW` and `ECDH-1PU+A256KW`. These now only allow authenticated content encryption in both `encrypt` and `decrypt`, and `encrypt` no longer takes an `iv` for them.

Askar no longer reports `ECDH-ES` with `A256CBC-HS512` as supported, as its key derivation can't produce the 64 byte key. Agents that also register the Node backend now encrypt it with Node.

```ts
// before
const ephemeralKey = await agent.kms.createKey({ type: { kty: 'EC', crv: 'P-256' } })
const header = JsonEncoder.toBase64Url({ alg: 'ECDH-ES', enc: 'A256GCM', epk: ephemeralKey.publicJwk })
const { encrypted, iv, tag } = await agent.kms.encrypt({
  key: { keyAgreement: { algorithm: 'ECDH-ES', keyId: ephemeralKey.keyId, externalPublicJwk: recipientJwk } },
  encryption: { algorithm: 'A256GCM', aad: TypedArrayEncoder.fromUtf8String(header) },
  data,
})
await agent.kms.deleteKey({ keyId: ephemeralKey.keyId })

// after
let header: string | undefined
const { encrypted, iv, tag } = await agent.kms.encrypt({
  key: { keyAgreement: { algorithm: 'ECDH-ES', externalPublicJwk: recipientJwk } },
  encryption: {
    algorithm: 'A256GCM',
    aad: ({ ephemeralPublicJwk }) => {
      header = JsonEncoder.toBase64Url({ alg: 'ECDH-ES', enc: 'A256GCM', epk: ephemeralPublicJwk })
      return TypedArrayEncoder.fromUtf8String(header)
    },
  },
  data,
})
```
