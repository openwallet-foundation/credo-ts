---
'@credo-ts/core': patch
'@credo-ts/cheqd': patch
---

Updating a DID takes a `deleteRemovedKeys` option. Once the update is done, it deletes the KMS keys of the verification methods the update removed from the DID document, unless a remaining verification method uses the same key. The option is off by default. It also deletes keys you passed in and keys another DID still uses. It works for registrars that return the removed keys in the new `removedKeys` of the update result, which the did:cheqd and did:hedera registrars do. A key that fails to delete is logged and doesn't fail the update.

```ts
await agent.dids.update({ did, didDocument, deleteRemovedKeys: true })
```
