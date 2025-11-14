---
"@credo-ts/anoncreds": minor
"@credo-ts/openid4vc": minor
"@credo-ts/didcomm": minor
"@credo-ts/tenants": minor
"@credo-ts/askar": minor
"@credo-ts/core": minor
---

BREAKING CHANGE:

`label` and `connectionImageUrl` have been dropped from Agent configuration. Therefore, it must be specified manually in all DIDComm connection establishment related methods. If you don't want to specify any label, just use an empty value.

In the particular case of mediation provisioning through a `mediatorInvitationUrl`, the label will be always set to an empty value ('').
