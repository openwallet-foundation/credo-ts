---
'@credo-ts/didcomm': patch
---

`DidCommConnectionsApi.deleteById` and `DidCommOutOfBandApi.deleteById` take a `deleteAssociatedKeys` option that also deletes the KMS keys and did:peer DIDs Credo created for the record. `hangup` takes the same option, which requires `deleteAfterHangup`. Before, these keys were never deleted. The option is off by default.

Connections and out-of-band records now store which DIDs and keys Credo created for them, and only those are deleted. Keys and DIDs you passed in (`routing`, `ourDid`, `toDid`, `invitationDid`) are kept, and so are the ones an invitation shares with its connections, such as the key a single-use invitation passes on to its connection. A DID Credo created for one record is also kept, with its keys, while another connection or invitation uses it because you passed it on as `ourDid`, `toDid` or `invitationDid`. It is then yours to delete, with `dids.deleteCreatedDid`. Records created before this change don't have this information, so nothing is deleted for them.

To delete routing you created yourself together with the record that uses it, set `deleteWithRecord: true` on the routing you pass in. Only do this for routing you use for one record. Credo doesn't know about other records you passed the same routing to, and deleting one of them deletes the keys the others use.

Deleted keys and DIDs are also removed from the mediator that routes them, and a `DidCommRoutingDeletedEvent` is emitted. Use `mediationRecipient.deleteRouting(routing)` to do the same for routing you created with `mediationRecipient.getRouting`.

When the inviter of a DIDComm v2 reusable or implicit invitation fails to rotate to a new DID for a connection, the DID and keys it created for that are now deleted.

```ts
await agent.didcomm.connections.deleteById(connectionId, { deleteAssociatedKeys: true })
await agent.didcomm.oob.deleteById(outOfBandId, { deleteAssociatedKeys: true })
await agent.didcomm.mediationRecipient.deleteRouting(routing)
```
