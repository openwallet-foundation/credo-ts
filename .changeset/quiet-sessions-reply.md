---
'@credo-ts/didcomm': minor
'@credo-ts/node': patch
---

Fix replies going to the wrong transport session when one connection has several requests open at the same time, for example a wallet that sends two message pickup requests with `return_route` over HTTP while `processDidCommMessagesConcurrently` is enabled. One of the requests was answered with the reply to the other and the other request failed with a 500 response.

`DidCommTransportService.saveSession` no longer removes the other open sessions of the connection, so each request keeps its own session. A reply to an inbound message is sent over the session that message came in on. If that session is gone, for example because a WebSocket client reconnected, the reply goes over another open session of the connection, but never over a session that answers a single request, such as an HTTP session. Without such a session it goes to a service endpoint or the queue.

`DidCommTransportSession` has two new optional properties for this, which the sessions of `@credo-ts/node` implement: `isClosed` and `isSingleResponse`. `findSessionByConnectionId` returns the most recently saved session and skips closed ones. A custom inbound transport should remove its sessions when they end. Saving a session only removes the other sessions of the connection that report `isClosed`.

The HTTP inbound transport now removes a session when the client closes the connection. It listened on the request, which closes as soon as the body is read. The polling pickup loop of the mediation recipient no longer starts a round while the previous one is still sending and keeps polling after a failed round.
