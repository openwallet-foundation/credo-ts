---
'@credo-ts/didcomm': minor
---

Now using did:peer:4 by default when creating DID Exchange Requests as response to an Out of Band invitation.

It is possible to return to previous behaviour by manually setting `peerNumAlgoForDidExchangeRequests` option in DIDComm Connections module config.
