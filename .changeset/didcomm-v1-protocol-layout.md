---
'@credo-ts/didcomm': patch
---

The messages and handlers of the Routing 1.0 and Basic Message 1.0 protocols moved to `modules/routing/protocol/v1` and `modules/basic-messages/protocol/v1`, the layout that the credentials, proofs, discover-features and message-pickup modules already use. The exports of `@credo-ts/didcomm` are unchanged. A deep import of a moved file (for example `@credo-ts/didcomm/build/modules/routing/messages`) must point at the new path.
