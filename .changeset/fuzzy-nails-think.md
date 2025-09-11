---
"@credo-ts/action-menu": minor
"@credo-ts/anoncreds": minor
"@credo-ts/question-answer": minor
"@credo-ts/cheqd": minor
"@credo-ts/drpc": minor

---

- All `didcomm` package modules, APIs, models and services that are used for dependency injection now include `DidComm` in its naming (most of them are prefixed, while others just include it somewhere in the name for a more appropriate naming, e.g. OutboundDidCommTransport`)
- DIDComm-related events have also changed their text string to make it possible to distinguish them from events triggered by other protocols
- DIDComm credentials module API has been updated to use the term `credentialExchangeRecord` instead of `credentialRecord`, since it is usually confused with W3cCredentialRecords (and potentially other kind of credential records we might have). I took this opportunity to also update `declineOffer` options structure to match DIDComm proofs module API
- DIDComm-related records were renamed, but their type is still the original one (e.g. `CredentialRecord`, `BasicMessageRecord`). Probably it's worth to take this major release to do the migration, but I'm afraid that it will be a bit risky, so I'm hesitating to do so or leaving it for some other major upgrade (if we think it's actually needed)
