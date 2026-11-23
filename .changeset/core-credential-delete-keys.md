---
'@credo-ts/core': patch
---

`sdJwtVc.deleteById`, `mdoc.deleteById`, `w3cCredentials.deleteById` and `w3cV2Credentials.deleteById` take a `deleteAssociatedKeys` option. It deletes the holder keys and DIDs stored on the credential record as created only for that credential, with the keys of those DIDs. The OpenID4VCI holder and the DIDComm credential formats store them on the record when the holder binding has `createdForCredential`. Other keys and DIDs are kept, including those of records without this information, such as records stored before this change. The option is off by default.

Deletion doesn't check whether another credential or a DID uses a stored key or DID, so `createdForCredential` must only be set on a binding used by one credential.

```ts
await agent.sdJwtVc.deleteById(recordId, { deleteAssociatedKeys: true })
```
