---
'@credo-ts/core': minor
---

KMS `decrypt` renames its public key fields to say which key they hold. For `ECDH-ES` and `ECDH-ES+KW` the sender's ephemeral key moves from `externalPublicJwk` to `ephemeralPublicJwk`. For `ECDH-HSALSA20` the sender key moves from `externalPublicJwk` to `senderPublicJwk`. `KmsEncryptedKey` no longer has `iv` and `tag`, and `KmsKeyAgreementEcdhEs` is replaced by `KmsKeyAgreementEncryptEcdhEs` and `KmsKeyAgreementDecryptEcdhEs`.

If you wrote your own KMS backend, its `encrypt` now has to:

- call `encryption.aad({ ephemeralPublicJwk })` once when it is a function, and use the result as the AAD
- generate the ECDH ephemeral key itself
- return `ephemeralPublicJwk`, and `encryptedKeys` for the key wrapping algorithms

`ECDH-ES` and `ECDH-ES+KW` options that reach a backend through `KeyManagementApi` never carry a `keyId`.
