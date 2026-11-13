---
"@credo-ts/anoncreds": minor
"@credo-ts/didcomm": minor
---

Extract the complete Revocation Notification protocol into the optional
`AnonCredsDidCommRevocationNotificationModule` from `@credo-ts/anoncreds/didcomm`.
It owns V1/V2 messages, handlers, protocol discovery, V2 sending, and AnonCreds record processing.

Applications must register this module alongside AnonCreds and DIDComm with credentials enabled.
Without it, the protocol is neither advertised nor handled. Move calls from
`agent.didcomm.credentials.sendRevocationNotification` to the registered extension's
`agent.modules.<moduleKey>.sendRevocationNotification` API, and import notification messages,
their option types, and `SendRevocationNotificationOptions` from `@credo-ts/anoncreds/didcomm`.

Preserve connection and credential-exchange-based sending, comments, acknowledgement requests,
exact identifier matching, the persisted exchange-record notification field, and the existing
`DidCommRevocationNotificationReceived` event. Indy-VDR remains separately configured, and the
AnonCreds package root remains independent of DIDComm.
