---
'@credo-ts/didcomm': patch
---

fix: only close a transport session for the message that opened it. Previously a later message without return routing (e.g. the trust ping sent while connecting to a mediator) could close a WebSocket session that was still needed to return a response, causing intermittent mediation timeouts.

`DidCommWsOutboundTransport` now also replaces sockets that are no longer open, instead of reusing them.
