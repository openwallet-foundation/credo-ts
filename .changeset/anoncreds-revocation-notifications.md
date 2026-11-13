---
"@credo-ts/anoncreds": minor
"@credo-ts/didcomm": minor
---

Move AnonCreds revocation-notification parsing and record processing into
`@credo-ts/anoncreds/didcomm`, leaving DIDComm with a protocol-neutral processor interface.

Register `AnonCredsDidCommRevocationNotificationModule` alongside the AnonCreds and DIDComm modules
to continue processing revocation notifications. Without a registered processor, incoming
notifications are now ignored with a warning instead of being processed automatically.
Existing identifier matching remains exact.
