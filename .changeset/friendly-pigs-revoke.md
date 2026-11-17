---
"@credo-ts/didcomm": minor
"@credo-ts/anoncreds": minor
---

Keep Revocation Notification V2 in DIDComm and make credential identifier handling configurable through
`DidCommCredentialsModuleConfig.revocationNotificationFormats`. Export an AnonCreds format service for
`anoncreds` and `indy-anoncreds`, with registry-aware identifier variant lookup; retire the AnonCreds-only
Revocation Notification V1 protocol.

Migration: `revocationNotificationFormats` defaults to an empty list. To continue receiving AnonCreds
Revocation Notification V2 messages after upgrading, explicitly register the AnonCreds format service
in your DIDComm credentials configuration. Registering `AnonCredsModule` alone does not enable these
notifications. The format service supports both `anoncreds` and `indy-anoncreds` identifiers:

```ts
import { AnonCredsDidCommRevocationNotificationFormatService } from '@credo-ts/anoncreds/didcomm'
import { DidCommModule } from '@credo-ts/didcomm'

const didcomm = new DidCommModule({
  credentials: {
    revocationNotificationFormats: [new AnonCredsDidCommRevocationNotificationFormatService()],
  },
})
```

Without a configured format service, the V2 handler and feature are not registered.
