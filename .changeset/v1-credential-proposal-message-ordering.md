---
'@credo-ts/anoncreds': patch
---

The Issue Credential V1 protocol now stores the proposal and offer messages before emitting the credential state changed event.

`processProposal` emitted the state changed event for the `proposal-received` state before the proposal message itself was stored. Handlers of that event that look the message up by the credential exchange record id — such as auto accept, or a call to `acceptProposal` — could run before the write completed and fail with `RecordNotFoundError: DidCommMessageRecord: No record found for given query`. The same ordering issue applied to the offer message when accepting or negotiating a proposal.

Every other `process*` method in the V1 credential protocol, and the V1 proof and V2 credential protocols, already stored the message first.
