---
"@credo-ts/anoncreds": minor
"@credo-ts/didcomm": minor
---

Move AnonCreds revocation-notification parsing and record processing into
`@credo-ts/anoncreds/didcomm`, leaving DIDComm with a protocol-neutral processor interface.

Register `AnonCredsDidCommRevocationNotificationModule` alongside the AnonCreds and DIDComm
modules to process AnonCreds revocation notifications. Incoming notifications fail explicitly
when no processor is registered. Existing identifier matching remains exact.
