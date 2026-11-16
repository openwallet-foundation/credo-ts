---
'@credo-ts/core': patch
---

The `eddsa-jcs-2022` cryptosuite now shares its proof processing with `ecdsa-jcs-2019`. As a result, `eddsa-jcs-2022`:

- verifies documents whose `@context` contains an inline context object, which it used to reject. The `@context` entries of the document and the proof are now compared by value.
- fails before calling the KMS, with an error that names the supported key type, for verification methods that are not Ed25519 keys. The KMS rejected these keys before.
- returns `verified: false` for a signature that is not 64 bytes, without calling the KMS.
