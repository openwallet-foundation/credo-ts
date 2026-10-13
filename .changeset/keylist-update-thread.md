---
"@credo-ts/didcomm": patch
---

Fixed concurrent keylist updates to the same mediator resolving each other. `keylistUpdateAndAwait` now waits for the `KeylistUpdateResponse` threaded to its own `KeylistUpdate`, so when several connections are created at once (for example through a multi-use invitation) none of them continues before the mediator has registered its key. Unthreaded responses are still accepted.

The `DidCommRecipientKeylistUpdated` event payload now includes the `threadId` of the response.
