---
"@credo-ts/core": minor
"@credo-ts/anoncreds": patch
"@credo-ts/cheqd": patch
"@credo-ts/didcomm": patch
"@credo-ts/webvh": patch
---

Add `DidDocument.findVerificationMethodsByPurpose` and
`DidDocument.findVerificationMethodsByTypeAndPurpose`.

The relationship-aware methods resolve inline and referenced methods and
return them in requested relationship order while preserving entry order
within each relationship. The type-filtered method accepts one or more
verification-method representations and delegates relationship traversal to
the purpose-only method. DIDComm JSON-LD, JWT credentials, presentation
selection, DIDComm messaging, AnonCreds data integrity, Cheqd signing, peer
DID conversion, and did:webvh signing now use the appropriate shared lookup.
AnonCreds credential signing prefers verification methods authorized for
`assertionMethod`, with declared `verificationMethod` entries as a fallback.
