---
'@credo-ts/didcomm': patch
---

`offerCredential`, `createOffer` and `proposeCredential` of the credentials module take an optional `parentThreadId`. It is stored on the credential exchange record and sent as the parent thread (`pthid`) of the offer or proposal, so that an issuance that is a step of an enclosing exchange can name that exchange, as `requestProof` and `proposeProof` already allow.
