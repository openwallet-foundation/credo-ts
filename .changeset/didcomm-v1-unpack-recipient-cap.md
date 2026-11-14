---
'@credo-ts/didcomm': patch
---

A DIDComm v1 encrypted message with more than 32 recipients is rejected before any recipient key is resolved, and resolution stops at the first key of ours. Before, every recipient cost several storage lookups with no limit, so an unauthenticated sender could keep an agent busy with one large message. A message was also rejected when our key was not the last recipient.
