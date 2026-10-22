---
'@credo-ts/didcomm': patch
---

The `DidCommMessageProcessed` event payload now includes `handled`, which is `false` when no message handler ran, for example because a middleware dropped the message without calling `next`.
