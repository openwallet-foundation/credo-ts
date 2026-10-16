---
'@credo-ts/core': minor
'@credo-ts/askar': minor
'@credo-ts/node': minor
'@credo-ts/openid4vc': patch
---

KMS `encrypt` now supports multiple recipients for ECDH key wrapping, and the Askar and Node backends support `ECDH-1PU+A256KW`. This changes the KMS API:

- The KMS creates the ECDH ephemeral key itself and never stores it. `ECDH-ES` and `ECDH-ES+KW` no longer take a `keyId`, and `encrypt` returns the key as `ephemeralPublicJwk`. A `keyId` in `keyAgreement` now always means the sender's key.
- `ECDH-ES+A128KW`, `ECDH-ES+A192KW`, `ECDH-ES+A256KW` and `ECDH-1PU+A256KW` take a `recipients` array and return `encryptedKeys` in the same order. All recipients must use the same curve. `encryptedKey` is removed from the result.
- `encryption.aad` can be a callback that receives the `ephemeralPublicJwk`, for example to put `epk` in a JWE protected header. This is only allowed with ECDH key agreement.
- ECDH key agreement only allows authenticated content encryption, without an `iv`. `ECDH-1PU+A256KW` needs an `A*CBC-HS*` algorithm, also on decrypt. `supportedBackendsForOperation` returns no backends for other combinations.
- In `decrypt`, the ephemeral key for `ECDH-ES` and `ECDH-ES+KW` moves from `externalPublicJwk` to `ephemeralPublicJwk`, and the sender key for `ECDH-HSALSA20` moves to `senderPublicJwk`.
- `KmsEncryptedKey` no longer has `iv` and `tag`. `KmsKeyAgreementEcdhEs` is replaced by `KmsKeyAgreementEncryptEcdhEs` and `KmsKeyAgreementDecryptEcdhEs`.
- Askar no longer reports `ECDH-ES` with `A256CBC-HS512` as supported, as its key derivation cannot produce the 64 byte key. Agents that also register the Node backend now use Node for it.

OpenID4VP response encryption no longer stores and deletes an ephemeral key for every response. The `epk` in the JWE header no longer has a `kid`.
