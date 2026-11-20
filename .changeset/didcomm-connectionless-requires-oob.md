---
'@credo-ts/didcomm': minor
---

Connection-less exchanges now require an out-of-band record, created with the out-of-band API (including `createLegacyConnectionlessInvitation` and `receiveInvitation`). Credo rejects incoming connection-less messages and fails outgoing ones without an out-of-band record for the thread. This includes exchanges started without one before upgrading. A message on a new thread, such as a revocation notification, uses the out-of-band record of the exchange it belongs to. Before, Credo created routing keys for such an exchange and never stored or deleted them.

Deleting the out-of-band record, with or without `deleteAssociatedKeys`, now ends the exchange. Credo rejects later messages on it, such as a revocation notification or a problem report. Before, you could delete the out-of-band record once the exchange was done. Keep it for as long as you expect messages on the exchange.
