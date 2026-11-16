---
'@credo-ts/didcomm': minor
---

Connection-less exchanges now require an out-of-band record, created with the out-of-band API (including `createLegacyConnectionlessInvitation` and `receiveInvitation`). Credo rejects incoming connection-less messages and fails outgoing ones without an out-of-band record for the thread. This includes exchanges started without one before upgrading. Before, Credo created routing keys for such an exchange and never stored or deleted them.
