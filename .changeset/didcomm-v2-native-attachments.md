---
'@credo-ts/didcomm': patch
---

Issue credential 2.0 and present proof 2.0 messages sent over DIDComm v2 now carry their format attachments in the top-level `attachments` array, with the `format` on each attachment.
