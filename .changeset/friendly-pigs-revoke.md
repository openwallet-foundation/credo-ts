---
"@credo-ts/didcomm": minor
"@credo-ts/anoncreds": minor
---

Keep Revocation Notification V2 in DIDComm and make credential identifier handling configurable through
`DidCommCredentialsModuleConfig.revocationNotificationFormats`. Export an AnonCreds format service for
`anoncreds` and `indy-anoncreds`, with registry-aware identifier variant lookup; retire the AnonCreds-only
Revocation Notification V1 protocol.
