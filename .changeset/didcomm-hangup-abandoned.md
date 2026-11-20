---
'@credo-ts/didcomm': minor
---

A connection that is hung up now moves to the `abandoned` state and emits a `DidCommConnectionStateChanged` event, on both sides. This applies to the DID Rotate 1.0 `hangup` message and to the DIDComm v2 rotation to nothing. The `errorMessage` of the connection says which party hung up, as a `DidCommConnectionHangupReason`. Before, the connection stayed `completed` and only lost its `did` or `theirDid`.

An abandoned connection is not ready, so a message that arrives on it after the hang-up is no longer processed, also on the side that hung up. The DIDComm v2 message that carries the termination is still processed.

Connections that were hung up before this change are read as `abandoned`. Their stored `state` tag changes when the record is saved again, so a query on `state` can return them as `completed` until then.
