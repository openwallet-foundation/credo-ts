---
'@credo-ts/didcomm': patch
---

`DidCommInboundMessageContext.assertReadyConnection()` now also asserts that the envelope proved the sender is the peer of the connection: a DIDComm v1 authcrypt sender key, a v2 authcrypt sender or a v2 signature. A handler that accepts a plaintext message on a connection on purpose passes `{ allowUnauthenticatedSender: true }`. Before, a plaintext message delivered through an out-of-band `requests~attach` and accepted on an existing connection reached every handler with that connection and no proven sender, so a third party who copied the services of a public invitation could rotate the DID of the peer to its own, end the relationship or change the mediator routing.
