---
"@credo-ts/drpc": patch
"@credo-ts/didcomm": patch
---

`DrpcApi.recvRequest` and the response listener returned by `DrpcApi.sendRequest` now clear their timeout when the request or response arrives, so the process no longer stays alive until the full timeout has passed. The timeouts are in milliseconds, as the documentation now says.

`DidCommHttpOutboundTransport` clears its 15 second request timeout when the request fails, so a failed request no longer keeps the process alive.
