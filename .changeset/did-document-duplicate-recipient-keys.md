---
'@credo-ts/core': patch
---

`DidDocument.getRecipientKeysWithVerificationMethod` and `DidDocument.recipientKeys` now return a key once when several DIDComm services of the document reference the same verification method. Before, the key was returned once per service, so the `recipientKeyFingerprints` tag of a `DidRecord` contained duplicate fingerprints.
