---
'@credo-ts/didcomm': patch
---

- `connections.deleteById` now removes the mediator routing of a connection that was hung up before. The hangup clears the `did` of the record, so the routing of its last did was never removed. `hangup({ deleteAfterHangup: true })` relies on this and no longer removes the routing itself.
- `DidCommDocumentService.resolveCreatedDidDocumentWithKeysByRecipientKey` no longer fails when the Ed25519 recipient key of an inbound message is not a valid Ed25519 point (for example X25519 bytes in a legacy `~service` decorator). The lookup continues with the out-of-band and mediator records instead.
- `DidCommConnectionService.returnWhenIsConnected` rejects an empty `connectionId` with a clear `CredoError` before it subscribes to connection events, instead of a `RecordNotFoundError` from the record lookup with a subscription that stays open until the timeout.
