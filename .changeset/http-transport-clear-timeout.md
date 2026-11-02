---
"@credo-ts/didcomm": patch
---

`DidCommHttpOutboundTransport` clears its 15 second request timeout when the request fails, so a failed request no longer keeps the process alive.
