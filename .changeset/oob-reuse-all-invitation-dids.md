---
'@credo-ts/didcomm': patch
---

Receiving an out-of-band invitation with `reuseConnection: true` now looks for an existing connection for every DID in the invitation. Before, only the first one was checked, so a connection made through a later service of the invitation was not found and a new connection was created.

This also finds connections again that Credo 0.5.1 or earlier created from an invitation with an inline service, or that were migrated from 0.1. They store the invitation DID in an older format, which has not been looked up since 0.5.2, also for invitations with a single service. Connections that were hung up or abandoned, that are not completed yet, or that use DIDComm v2 are now skipped, so a new connection is created. Before, reusing them failed or waited 15 seconds for the handshake reuse to time out.
