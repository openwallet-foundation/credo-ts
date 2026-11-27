---
'@credo-ts/didcomm': patch
---

`offerCredential`, `createOffer` and `proposeCredential` of the credentials module take an optional `parentThreadId`. It is stored on the credential exchange record and sent as the parent thread (`pthid`) of the offer or proposal, so that an issuance that is a step of an enclosing exchange can name that exchange, as `requestProof` and `proposeProof` already allow.

`createInvitation` of the out-of-band module now throws when an attached message has a parent thread id. The response to an invitation uses the invitation id as its parent thread, so a holder rejected such an invitation. This also applies to a proof request created with a `parentThreadId`. A legacy connectionless invitation sends no invitation id, so its message keeps its parent thread id, and the receiver accepts it.
