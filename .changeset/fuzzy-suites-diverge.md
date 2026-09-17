---
"@credo-ts/core": patch
---

Fix `Ed25519Signature2018` incorrectly accepting `Ed25519VerificationKey2020` verification methods (previously converted at runtime from multibase to base58), and register `Ed25519Signature2020` with its own required `Ed25519VerificationKey2020` verification method type instead of sharing acceptance with `Ed25519Signature2018`. Each suite now strictly enforces its own verification method type, with error messages identifying both the offending key type and the proof type.

`W3cJsonLdCredentialService#signCredential` and `#signPresentation` now share a single suite-preparation path that resolves and validates the verification method against the suite's required key type before signing, replacing duplicated per-method logic.

Also fixes missing `@type: multibase` typing for `publicKeyMultibase`/`proofValue` and missing `capabilityInvocation`, `capabilityDelegation`, and `keyAgreement` term definitions in the `ed25519-2020` JSON-LD context, which caused JSON-LD framing/expansion failures when dynamically signing and verifying credentials and presentations with `Ed25519Signature2020` DIDs.
