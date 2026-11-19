---
'@credo-ts/core': patch
---

`sdJwtVc.deleteById`, `mdoc.deleteById`, `w3cCredentials.deleteById` and `w3cV2Credentials.deleteById` take a `deleteAssociatedKeys` option. It deletes the holder binding keys of the credential (`credentialInstances[].kmsKeyId`), including those of instances that were already used. For instances stored without a `kmsKeyId` it deletes the key under the legacy key id. It also deletes the DID records and keys of DIDs that were created only for the credential, which OpenID4VCI and DIDComm issuance store on the record when you set `createdForCredential`. The option is off by default.

```ts
await agent.sdJwtVc.deleteById(recordId, { deleteAssociatedKeys: true })
```
