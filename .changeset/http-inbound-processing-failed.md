---
'@credo-ts/node': patch
---

The HTTP inbound transport answers 500 as soon as processing a message fails. It used to wait for the processing timeout and log a timeout error.
