---
'@credo-ts/didcomm': patch
---

`DidCommInboundMessageContext.assertAuthenticatedReadyConnection()` asserts that the envelope proved the sender is the peer of the connection. The did-rotate, hangup, mediation grant and mediation deny handlers use it. Before, a plaintext message delivered through an out-of-band `requests~attach` and accepted on an existing connection reached these handlers with that connection and no proven sender, so a third party who copied the services of a public invitation could rotate the DID of the peer to its own, end the relationship or change the mediator routing.
