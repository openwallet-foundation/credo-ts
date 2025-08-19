---
"@credo-ts/indy-sdk-to-askar-migration": patch
"@credo-ts/anoncreds": patch
"@credo-ts/openid4vc": patch
"@credo-ts/didcomm": patch
"@credo-ts/tenants": patch
"@credo-ts/askar": patch
"@credo-ts/core": patch
---

BREAKING CHANGE:

`label` and `connectionImageUrl` have been dropped from Agent configuration. Therefore, it must be specified manually in all DIDComm connection establishment related methods. If you don't want to specify any label, just use an empty value.

In the particular case of mediation provisioning through a `mediatorInvitationUrl`, the label will be always set to an empty value ('').
