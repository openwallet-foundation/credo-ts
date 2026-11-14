---
'@credo-ts/didcomm': patch
---

A DIDComm v1 encrypted message with more recipients than `maxV1EnvelopeRecipients` in the DIDComm module config, 8 by default, is rejected before any recipient key is resolved, and resolution stops at the first key of ours. Before, every recipient cost several storage lookups with no limit, so an unauthenticated sender could keep an agent busy with one large message. A message was also rejected when our key was not the last recipient.
