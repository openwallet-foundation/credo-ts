---
'@credo-ts/core': patch
---

`DidDocument.getRecipientKeysWithVerificationMethod` and `DidDocument.recipientKeys` now return each key once. Before, a key was returned once per DIDComm service that referenced it, and once per verification method that carried it, so the `recipientKeyFingerprints` tag of a `DidRecord` contained duplicate fingerprints. With `mapX25519ToEd25519`, an X25519 key whose Ed25519 counterpart is also a recipient key is returned once as well.
