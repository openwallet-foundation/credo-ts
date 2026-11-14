---
'@credo-ts/node': patch
---

The HTTP inbound transport now answers `202 Accepted` instead of `200 OK` when a received DIDComm message is processed without a response message travelling back over the same HTTP connection, as DIDComm Messaging recommends. A response message is still returned with `200 OK`.
