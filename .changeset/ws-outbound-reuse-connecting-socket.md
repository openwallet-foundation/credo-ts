---
'@credo-ts/didcomm': patch
---

`DidCommWsOutboundTransport` sends messages that arrive while a socket to the same endpoint and connection is still connecting over that socket, instead of opening a second one and orphaning the first. A socket opened for messages without return routing is closed after the last of them is sent, and `stop()` and `closeSocketByConnectionId` also close sockets that are still connecting and reject their pending sends.
