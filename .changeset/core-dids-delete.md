---
'@credo-ts/core': patch
---

Add `dids.deleteCreatedDid` to delete the record of a DID the agent created. With `deleteAssociatedKeys: true` it also deletes the keys of the DID. It doesn't deactivate the DID, so deactivate it first when the DID method supports it.

```ts
await agent.dids.deleteCreatedDid({ did, deleteAssociatedKeys: true })
```
