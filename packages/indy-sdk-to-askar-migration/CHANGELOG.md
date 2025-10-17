# Changelog

## 0.6.0

### Minor Changes

- 879ed2c: deprecate node 18
- e936068: when signing in Credo, it is now required to always reference a key id. For DIDs this is extracted from the DidRecord, and for JWKs (e.g. in holder binding) this is extracted form the `kid` of the JWK. For X509 certificates you need to make sure there is a key id attached to the certificate manually for now, since we don't have a X509 record like we have a DidRecord. For x509 certificates created before 0.6 you can use the legacy key id (`certificate.keyId = certificate.publicJwk.legacyKeyId`), for certificates created after 0.6 you need to manually store the key id and set it on the certificate after decoding.

  For this reason, we now require instances of X509 certificates where we used to require encoded certificates, to allow you to set the keyId on the certificate beforehand.

- e936068: The `Key` and `Jwk` classes have been removed in favour of a new `PublicJwk` class, and all APIs in Credo have been updated to use the new `PublicJwk` class. Leveraging Jwk as the base for all APIs provides more flexility and makes it easier to support key types where it's not always so easy to extract the raw public key bytes. In addition all the previous Jwk relatedfunctionality has been replaced with the new KMS jwk functionalty. For example `JwaSignatureAlgorithm` is now `Kms.KnownJwaSignatureAlgorithms`.
- e936068: The wallet API has been completely rewritten to be more generic, support multiple backends at the same time, support generic encrypting and decryption, support symmetric keys, and enable backends that use key ids rather than the public key to identify a key. This has resulted in significant breaking changes, and all usages of the wallet api should be updated to use the new `agent.kms` APIs. In addition the wallet is not available anymore on the agentContext. If you used this, instead inject the KMS API using `agentContext.resolve(Kms.KeyManagementApi)`.
- 70c849d: update target for tsc compiler to ES2020. Generally this should not have an impact for the supported environments (Node.JS / React Native). However this will have to be tested in React Native
- 81e3571: BREAKING CHANGE:

  `label` and `connectionImageUrl` have been dropped from Agent configuration. Therefore, it must be specified manually in all DIDComm connection establishment related methods. If you don't want to specify any label, just use an empty value.

  In the particular case of mediation provisioning through a `mediatorInvitationUrl`, the label will be always set to an empty value ('').

- 281471e: - depend on @openwallet-foundation/askar instead of @hyperledger/aries-askar
- bc6f0c7: Add support for both CJS and ESM module syntax.

  - Use `tsdown` to bundle for both CJS and ESM (bridge period) -> tsdown is based on rust, so it should help with performance
  - Update to `vitest` since jest doesn't work well with ESM -> this should also help with performance
  - Simplify type checking -> just a single type check script instead of one for all packages. This should help with performance.

### Patch Changes

- 13cd8cb: feat: support node 22
- Updated dependencies [55318b2]
- Updated dependencies [e936068]
- Updated dependencies [43148b4]
- Updated dependencies [2d10ec3]
- Updated dependencies [6d83136]
- Updated dependencies [312a7b2]
- Updated dependencies [1495177]
- Updated dependencies [1810764]
- Updated dependencies [879ed2c]
- Updated dependencies [297d209]
- Updated dependencies [2312bb8]
- Updated dependencies [11827cc]
- Updated dependencies [9f78a6e]
- Updated dependencies [297d209]
- Updated dependencies [bea846b]
- Updated dependencies [13cd8cb]
- Updated dependencies [15acc49]
- Updated dependencies [a666e94]
- Updated dependencies [df7580c]
- Updated dependencies [e936068]
- Updated dependencies [9befbcb]
- Updated dependencies [16f109f]
- Updated dependencies [e936068]
- Updated dependencies [617b523]
- Updated dependencies [90caf61]
- Updated dependencies [b5fc7a6]
- Updated dependencies [e936068]
- Updated dependencies [dca4fdf]
- Updated dependencies [9f78a6e]
- Updated dependencies [14673b1]
- Updated dependencies [607659a]
- Updated dependencies [44b1866]
- Updated dependencies [5f08bc6]
- Updated dependencies [27f971d]
- Updated dependencies [cacd8ee]
- Updated dependencies [e936068]
- Updated dependencies [2d10ec3]
- Updated dependencies [1bee6b7]
- Updated dependencies [1a4182e]
- Updated dependencies [90caf61]
- Updated dependencies [9f78a6e]
- Updated dependencies [e936068]
- Updated dependencies [290ff19]
- Updated dependencies [8baa7d7]
- Updated dependencies [decbcac]
- Updated dependencies [9df09fa]
- Updated dependencies [70c849d]
- Updated dependencies [897c834]
- Updated dependencies [a53fc54]
- Updated dependencies [81e3571]
- Updated dependencies [9ef54ba]
- Updated dependencies [8533cd6]
- Updated dependencies [e936068]
- Updated dependencies [edd2edc]
- Updated dependencies [e296877]
- Updated dependencies [9f78a6e]
- Updated dependencies [281471e]
- Updated dependencies [1f74337]
- Updated dependencies [c5e2a21]
- Updated dependencies [d59e889]
- Updated dependencies [e936068]
- Updated dependencies [425941e]
- Updated dependencies [e80794b]
- Updated dependencies [9f78a6e]
- Updated dependencies [9f78a6e]
- Updated dependencies [8baa7d7]
- Updated dependencies [decbcac]
- Updated dependencies [9befbcb]
- Updated dependencies [6c8ab94]
- Updated dependencies [bc6f0c7]
- Updated dependencies [0d49804]
- Updated dependencies [27f971d]
  - @credo-ts/core@0.6.0
  - @credo-ts/askar@0.6.0
  - @credo-ts/anoncreds@0.6.0
  - @credo-ts/node@0.6.0

## 0.5.13

### Patch Changes

- Updated dependencies [595c3d6]
  - @credo-ts/core@0.5.13
  - @credo-ts/anoncreds@0.5.13
  - @credo-ts/askar@0.5.13
  - @credo-ts/node@0.5.13

## 0.5.12

### Patch Changes

- Updated dependencies [3c85565]
- Updated dependencies [3c85565]
- Updated dependencies [7d51fcb]
- Updated dependencies [9756a4a]
  - @credo-ts/core@0.5.12
  - @credo-ts/askar@0.5.12
  - @credo-ts/anoncreds@0.5.12
  - @credo-ts/node@0.5.12

## 0.5.11

### Patch Changes

- @credo-ts/anoncreds@0.5.11
- @credo-ts/askar@0.5.11
- @credo-ts/core@0.5.11
- @credo-ts/node@0.5.11

## 0.5.10

### Patch Changes

- Updated dependencies [fa62b74]
  - @credo-ts/core@0.5.10
  - @credo-ts/anoncreds@0.5.10
  - @credo-ts/askar@0.5.10
  - @credo-ts/node@0.5.10

## 0.5.9

### Patch Changes

- @credo-ts/anoncreds@0.5.9
- @credo-ts/askar@0.5.9
- @credo-ts/core@0.5.9
- @credo-ts/node@0.5.9

## 0.5.8

### Patch Changes

- Updated dependencies [3819eb2]
- Updated dependencies [15d0a54]
- Updated dependencies [a5235e7]
  - @credo-ts/core@0.5.8
  - @credo-ts/anoncreds@0.5.8
  - @credo-ts/askar@0.5.8
  - @credo-ts/node@0.5.8

## 0.5.7

### Patch Changes

- Updated dependencies [352383f]
- Updated dependencies [1044c9d]
  - @credo-ts/core@0.5.7
  - @credo-ts/anoncreds@0.5.7
  - @credo-ts/askar@0.5.7
  - @credo-ts/node@0.5.7

## 0.5.6

### Patch Changes

- 66e696d: Fix build issue causing error with importing packages in 0.5.5 release
- Updated dependencies [66e696d]
  - @credo-ts/anoncreds@0.5.6
  - @credo-ts/askar@0.5.6
  - @credo-ts/core@0.5.6
  - @credo-ts/node@0.5.6

## 0.5.5

### Patch Changes

- 482a630: - feat: allow serving dids from did record (#1856)
  - fix: set created at for anoncreds records (#1862)
  - feat: add goal to public api for credential and proof (#1867)
  - fix(oob): only reuse connection if enabled (#1868)
  - fix: issuer id query anoncreds w3c (#1870)
  - feat: sd-jwt issuance without holder binding (#1871)
  - chore: update oid4vci deps (#1873)
  - fix: query for qualified/unqualified forms in revocation notification (#1866)
  - fix: wrong schema id is stored for credentials (#1884)
  - fix: process credential or proof problem report message related to connectionless or out of band exchange (#1859)
  - fix: unqualified indy revRegDefId in migration (#1887)
  - feat: verify SD-JWT Token status list and SD-JWT VC fixes (#1872)
  - fix(anoncreds): combine creds into one proof (#1893)
  - fix: AnonCreds proof requests with unqualified dids (#1891)
  - fix: WebSocket priority in Message Pick Up V2 (#1888)
  - fix: anoncreds predicate only proof with unqualified dids (#1907)
  - feat: add pagination params to storage service (#1883)
  - feat: add message handler middleware and fallback (#1894)
- Updated dependencies [3239ef3]
- Updated dependencies [d548fa4]
- Updated dependencies [482a630]
  - @credo-ts/core@0.5.5
  - @credo-ts/anoncreds@0.5.5
  - @credo-ts/askar@0.5.5
  - @credo-ts/node@0.5.5

## [0.5.3](https://github.com/openwallet-foundation/credo-ts/compare/v0.5.2...v0.5.3) (2024-05-01)

**Note:** Version bump only for package @credo-ts/indy-sdk-to-askar-migration

## [0.5.2](https://github.com/openwallet-foundation/credo-ts/compare/v0.5.1...v0.5.2) (2024-04-26)

### Bug Fixes

- node-ffi-napi compatibility ([#1821](https://github.com/openwallet-foundation/credo-ts/issues/1821)) ([81d351b](https://github.com/openwallet-foundation/credo-ts/commit/81d351bc9d4d508ebfac9e7f2b2f10276ab1404a))

## [0.5.1](https://github.com/openwallet-foundation/credo-ts/compare/v0.5.0...v0.5.1) (2024-03-28)

**Note:** Version bump only for package @credo-ts/indy-sdk-to-askar-migration

# [0.5.0](https://github.com/openwallet-foundation/credo-ts/compare/v0.4.2...v0.5.0) (2024-03-13)

**Note:** Version bump only for package @credo-ts/indy-sdk-to-askar-migration

## [0.4.2](https://github.com/hyperledger/aries-framework-javascript/compare/v0.4.1...v0.4.2) (2023-10-05)

**Note:** Version bump only for package @credo-ts/indy-sdk-to-askar-migration

## [0.4.1](https://github.com/hyperledger/aries-framework-javascript/compare/v0.4.0...v0.4.1) (2023-08-28)

**Note:** Version bump only for package @credo-ts/indy-sdk-to-askar-migration

# [0.4.0](https://github.com/hyperledger/aries-framework-javascript/compare/v0.3.3...v0.4.0) (2023-06-03)

### Bug Fixes

- **askar:** default key derivation method ([#1420](https://github.com/hyperledger/aries-framework-javascript/issues/1420)) ([7b59629](https://github.com/hyperledger/aries-framework-javascript/commit/7b5962917488cfd0c5adc170d3c3fc64aa82ef2c))
- migration of link secret ([#1444](https://github.com/hyperledger/aries-framework-javascript/issues/1444)) ([9a43afe](https://github.com/hyperledger/aries-framework-javascript/commit/9a43afec7ea72a6fa8c6133f0fad05d8a3d2a595))
- remove `deleteOnFinish` and added documentation ([#1418](https://github.com/hyperledger/aries-framework-javascript/issues/1418)) ([c8b16a6](https://github.com/hyperledger/aries-framework-javascript/commit/c8b16a6fec8bb693e67e65709ded05d19fd1919f))
- small issues with migration and WAL files ([#1443](https://github.com/hyperledger/aries-framework-javascript/issues/1443)) ([83cf387](https://github.com/hyperledger/aries-framework-javascript/commit/83cf387fa52bb51d8adb2d5fedc5111994d4dde1))

### Features

- **anoncreds:** store method name in records ([#1387](https://github.com/hyperledger/aries-framework-javascript/issues/1387)) ([47636b4](https://github.com/hyperledger/aries-framework-javascript/commit/47636b4a08ffbfa9a3f2a5a3c5aebda44f7d16c8))
- indy sdk aries askar migration script ([#1289](https://github.com/hyperledger/aries-framework-javascript/issues/1289)) ([4a6b99c](https://github.com/hyperledger/aries-framework-javascript/commit/4a6b99c617de06edbaf1cb07c8adfa8de9b3ec15))
