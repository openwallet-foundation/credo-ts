---
'@credo-ts/didcomm': patch
---

A transport session is now only closed by the message that opened it.

A session is closed when an inbound message does not request return routing, but sessions can be reused for multiple messages. A WebSocket is a duplex connection that carries every message the other agent sends over it, and the other agent has no way of knowing the session was closed. Any message it had already sent over that same connection therefore lost its return route: the response was queued instead of delivered, and the other agent waited until it timed out.

In practice this showed up as intermittent mediation failures. Connecting to a mediator sends a trust ping with `~transport.return_route` set to `none` in between the connection request and the `mediate-request`, both of which do use return routing. The trust ping closed the socket while the `mediate-request` was still in flight, so the `mediate-grant` was queued rather than returned and `requestAndAwaitGrant` timed out. See #1990.

Only the message that opened a session now closes it, so a session that is still being used for an ongoing exchange is left alone. Sessions opened by a message that does not request return routing are still closed immediately, so one-off inbound connections don't linger, and `TransportSession.close()` still unconditionally closes the session when called.

`DidCommWsOutboundTransport` also recovers better from sockets that are no longer usable:

- A socket that is not open is replaced with a new connection instead of reusing it or throwing `Socket is not open.`. Previously this only happened for sockets in the `CLOSING` state.
- A socket that is closing no longer removes its successor from the transport table, which could leave the replacement connection dangling.
- Sending a message over a socket that is not open is now correctly detected as opening a new socket, so one-off messages (without return routing) close that socket again afterwards rather than leaking it.
