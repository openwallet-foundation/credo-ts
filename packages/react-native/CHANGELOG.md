# Changelog

## 0.6.3

### Patch Changes

- Updated dependencies [73d2d59]
  - @credo-ts/core@0.6.3

## 0.6.2

### Patch Changes

- Updated dependencies [b9bd214]
- Updated dependencies [69acbc3]
- Updated dependencies [4a4473c]
- Updated dependencies [2c15356]
- Updated dependencies [4989dd9]
- Updated dependencies [0f7171a]
- Updated dependencies [e441cc1]
- Updated dependencies [1969c67]
- Updated dependencies [620bb38]
- Updated dependencies [2073110]
- Updated dependencies [620bb38]
  - @credo-ts/core@0.6.2

## 0.6.1

### Patch Changes

- Updated dependencies [9f60e1b]
  - @credo-ts/core@0.6.1

## 0.6.0

### Minor Changes

- 879ed2c: deprecate node 18
- d9e04db: expo-crypto is now a required peer dependency in React Native to handle hashing in the W3C JSON.LD libraries
- e936068: when signing in Credo, it is now required to always reference a key id. For DIDs this is extracted from the DidRecord, and for JWKs (e.g. in holder binding) this is extracted form the `kid` of the JWK. For X509 certificates you need to make sure there is a key id attached to the certificate manually for now, since we don't have a X509 record like we have a DidRecord. For x509 certificates created before 0.6 you can use the legacy key id (`certificate.keyId = certificate.publicJwk.legacyKeyId`), for certificates created after 0.6 you need to manually store the key id and set it on the certificate after decoding.

  For this reason, we now require instances of X509 certificates where we used to require encoded certificates, to allow you to set the keyId on the certificate beforehand.

- e936068: The `Key` and `Jwk` classes have been removed in favour of a new `PublicJwk` class, and all APIs in Credo have been updated to use the new `PublicJwk` class. Leveraging Jwk as the base for all APIs provides more flexility and makes it easier to support key types where it's not always so easy to extract the raw public key bytes. In addition all the previous Jwk relatedfunctionality has been replaced with the new KMS jwk functionalty. For example `JwaSignatureAlgorithm` is now `Kms.KnownJwaSignatureAlgorithms`.
- e936068: The wallet API has been completely rewritten to be more generic, support multiple backends at the same time, support generic encrypting and decryption, support symmetric keys, and enable backends that use key ids rather than the public key to identify a key. This has resulted in significant breaking changes, and all usages of the wallet api should be updated to use the new `agent.kms` APIs. In addition the wallet is not available anymore on the agentContext. If you used this, instead inject the KMS API using `agentContext.resolve(Kms.KeyManagementApi)`.
- 70c849d: update target for tsc compiler to ES2020. Generally this should not have an impact for the supported environments (Node.JS / React Native). However this will have to be tested in React Native
- bc6f0c7: Add support for ESM module syntax.

  - Use `tsdown` to bundle for ESM -> tsdown is based on rust, so it should help with performance
  - Update to `vitest` since jest doesn't work well with ESM -> this should also help with performance
  - Simplify type checking -> just a single type check script instead of one for all packages. This should help with performance.

  NOTE: Since React Native bundles your code, the update to ESM should not cause issues. In addition all latest minor releases of Node 20 and 22 now support requiring ESM modules. This means that even if you project is still a CommonJS project, it can now depend on ESM modules. For this reason Credo is now fully an ESM module.

  Initially we added support for both CJS and ESM in parallel. However this caused issues with some libraries requiring the CJS output, and other the ESM output. Since Credo is only meant to be installed a single time for the dependency injection to work correctly, this resulted in unexpected behavior.

- d9e04db: remove @azure/core-asynciterator-polyfill since we don't use any async interators anymore

### Patch Changes

- 13cd8cb: feat: support node 22
- Updated dependencies [55318b2]
- Updated dependencies [e936068]
- Updated dependencies [43148b4]
- Updated dependencies [2d10ec3]
- Updated dependencies [6d83136]
- Updated dependencies [312a7b2]
- Updated dependencies [1495177]
- Updated dependencies [2cace9c]
- Updated dependencies [879ed2c]
- Updated dependencies [297d209]
- Updated dependencies [2312bb8]
- Updated dependencies [11827cc]
- Updated dependencies [9f78a6e]
- Updated dependencies [297d209]
- Updated dependencies [0500765]
- Updated dependencies [bea846b]
- Updated dependencies [13cd8cb]
- Updated dependencies [2cace9c]
- Updated dependencies [15acc49]
- Updated dependencies [df7580c]
- Updated dependencies [e936068]
- Updated dependencies [16f109f]
- Updated dependencies [e936068]
- Updated dependencies [617b523]
- Updated dependencies [90caf61]
- Updated dependencies [e936068]
- Updated dependencies [dca4fdf]
- Updated dependencies [14673b1]
- Updated dependencies [0c274fe]
- Updated dependencies [2cace9c]
- Updated dependencies [607659a]
- Updated dependencies [44b1866]
- Updated dependencies [5f08bc6]
- Updated dependencies [27f971d]
- Updated dependencies [cacd8ee]
- Updated dependencies [e936068]
- Updated dependencies [2d10ec3]
- Updated dependencies [0500765]
- Updated dependencies [1a4182e]
- Updated dependencies [8be3d67]
- Updated dependencies [90caf61]
- Updated dependencies [9f78a6e]
- Updated dependencies [e936068]
- Updated dependencies [290ff19]
- Updated dependencies [8baa7d7]
- Updated dependencies [decbcac]
- Updated dependencies [9df09fa]
- Updated dependencies [2cace9c]
- Updated dependencies [70c849d]
- Updated dependencies [0c274fe]
- Updated dependencies [897c834]
- Updated dependencies [a53fc54]
- Updated dependencies [81e3571]
- Updated dependencies [9ef54ba]
- Updated dependencies [8533cd6]
- Updated dependencies [e936068]
- Updated dependencies [edd2edc]
- Updated dependencies [e296877]
- Updated dependencies [9f78a6e]
- Updated dependencies [1f74337]
- Updated dependencies [c5e2a21]
- Updated dependencies [d59e889]
- Updated dependencies [e936068]
- Updated dependencies [645363d]
- Updated dependencies [e80794b]
- Updated dependencies [9f78a6e]
- Updated dependencies [9f78a6e]
- Updated dependencies [8baa7d7]
- Updated dependencies [decbcac]
- Updated dependencies [6c8ab94]
- Updated dependencies [bc6f0c7]
- Updated dependencies [8be3d67]
- Updated dependencies [bd28bba]
- Updated dependencies [0d49804]
- Updated dependencies [27f971d]
  - @credo-ts/core@0.6.0

## 0.5.13

### Patch Changes

- Updated dependencies [595c3d6]
  - @credo-ts/core@0.5.13

## 0.5.12

### Patch Changes

- Updated dependencies [3c85565]
- Updated dependencies [3c85565]
- Updated dependencies [7d51fcb]
- Updated dependencies [9756a4a]
  - @credo-ts/core@0.5.12

## 0.5.11

### Patch Changes

- @credo-ts/core@0.5.11

## 0.5.10

### Patch Changes

- Updated dependencies [fa62b74]
  - @credo-ts/core@0.5.10

## 0.5.9

### Patch Changes

- @credo-ts/core@0.5.9

## 0.5.8

### Patch Changes

- Updated dependencies [3819eb2]
- Updated dependencies [15d0a54]
- Updated dependencies [a5235e7]
  - @credo-ts/core@0.5.8

## 0.5.7

### Patch Changes

- Updated dependencies [352383f]
- Updated dependencies [1044c9d]
  - @credo-ts/core@0.5.7

## 0.5.6

### Patch Changes

- 66e696d: Fix build issue causing error with importing packages in 0.5.5 release
- Updated dependencies [66e696d]
  - @credo-ts/core@0.5.6

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

## [0.5.3](https://github.com/openwallet-foundation/credo-ts/compare/v0.5.2...v0.5.3) (2024-05-01)

**Note:** Version bump only for package @credo-ts/react-native

## [0.5.2](https://github.com/openwallet-foundation/credo-ts/compare/v0.5.1...v0.5.2) (2024-04-26)

**Note:** Version bump only for package @credo-ts/react-native

## [0.5.1](https://github.com/openwallet-foundation/credo-ts/compare/v0.5.0...v0.5.1) (2024-03-28)

**Note:** Version bump only for package @credo-ts/react-native

# [0.5.0](https://github.com/openwallet-foundation/credo-ts/compare/v0.4.2...v0.5.0) (2024-03-13)

### Bug Fixes

- **rn:** more flexible react native version ([#1760](https://github.com/openwallet-foundation/credo-ts/issues/1760)) ([af82918](https://github.com/openwallet-foundation/credo-ts/commit/af82918f5401bad113dfc32fc903d981e4389c4e))

## [0.4.2](https://github.com/hyperledger/aries-framework-javascript/compare/v0.4.1...v0.4.2) (2023-10-05)

**Note:** Version bump only for package @credo-ts/react-native

## [0.4.1](https://github.com/hyperledger/aries-framework-javascript/compare/v0.4.0...v0.4.1) (2023-08-28)

### Bug Fixes

- check if URL already encoded ([#1485](https://github.com/hyperledger/aries-framework-javascript/issues/1485)) ([38a0578](https://github.com/hyperledger/aries-framework-javascript/commit/38a0578011896cfcf217713d34f285cd381ad72c))
- encode tails url ([#1479](https://github.com/hyperledger/aries-framework-javascript/issues/1479)) ([fd190b9](https://github.com/hyperledger/aries-framework-javascript/commit/fd190b96106ca4916539d96ff6c4ecef7833f148))

# [0.4.0](https://github.com/hyperledger/aries-framework-javascript/compare/v0.3.3...v0.4.0) (2023-06-03)

- feat!: add data, cache and temp dirs to FileSystem (#1306) ([ff5596d](https://github.com/hyperledger/aries-framework-javascript/commit/ff5596d0631e93746494c017797d0191b6bdb0b1)), closes [#1306](https://github.com/hyperledger/aries-framework-javascript/issues/1306)

### Features

- add fetch indy schema method ([#1290](https://github.com/hyperledger/aries-framework-javascript/issues/1290)) ([1d782f5](https://github.com/hyperledger/aries-framework-javascript/commit/1d782f54bbb4abfeb6b6db6cd4f7164501b6c3d9))
- add initial askar package ([#1211](https://github.com/hyperledger/aries-framework-javascript/issues/1211)) ([f18d189](https://github.com/hyperledger/aries-framework-javascript/commit/f18d1890546f7d66571fe80f2f3fc1fead1cd4c3))
- **anoncreds:** legacy indy proof format service ([#1283](https://github.com/hyperledger/aries-framework-javascript/issues/1283)) ([c72fd74](https://github.com/hyperledger/aries-framework-javascript/commit/c72fd7416f2c1bc0497a84036e16adfa80585e49))
- **askar:** import/export wallet support for SQLite ([#1377](https://github.com/hyperledger/aries-framework-javascript/issues/1377)) ([19cefa5](https://github.com/hyperledger/aries-framework-javascript/commit/19cefa54596a4e4848bdbe89306a884a5ce2e991))

### BREAKING CHANGES

- Agent-produced files will now be divided in different system paths depending on their nature: data, temp and cache. Previously, they were located at a single location, defaulting to a temporary directory.

If you specified a custom path in `FileSystem` object constructor, you now must provide an object containing `baseDataPath`, `baseTempPath` and `baseCachePath`. They can point to the same path, although it's recommended to specify different path to avoid future file clashes.

## [0.3.3](https://github.com/hyperledger/aries-framework-javascript/compare/v0.3.2...v0.3.3) (2023-01-18)

### Bug Fixes

- fix typing issues with typescript 4.9 ([#1214](https://github.com/hyperledger/aries-framework-javascript/issues/1214)) ([087980f](https://github.com/hyperledger/aries-framework-javascript/commit/087980f1adf3ee0bc434ca9782243a62c6124444))

### Features

- **indy-sdk:** add indy-sdk package ([#1200](https://github.com/hyperledger/aries-framework-javascript/issues/1200)) ([9933b35](https://github.com/hyperledger/aries-framework-javascript/commit/9933b35a6aa4524caef8a885e71b742cd0d7186b))

## [0.3.2](https://github.com/hyperledger/aries-framework-javascript/compare/v0.3.1...v0.3.2) (2023-01-04)

**Note:** Version bump only for package @credo-ts/react-native

## [0.3.1](https://github.com/hyperledger/aries-framework-javascript/compare/v0.3.0...v0.3.1) (2022-12-27)

**Note:** Version bump only for package @credo-ts/react-native

# [0.3.0](https://github.com/hyperledger/aries-framework-javascript/compare/v0.2.5...v0.3.0) (2022-12-22)

### Bug Fixes

- peer dependency for rn bbs signatures ([#785](https://github.com/hyperledger/aries-framework-javascript/issues/785)) ([c751e28](https://github.com/hyperledger/aries-framework-javascript/commit/c751e286aa11a1d2b9424ae23de5647efc5d536f))
- **react-native:** move bbs dep to bbs package ([#1076](https://github.com/hyperledger/aries-framework-javascript/issues/1076)) ([c6762bb](https://github.com/hyperledger/aries-framework-javascript/commit/c6762bbe9d64ac5220915af3425d493e505dcc2c))

### Features

- bbs createKey, sign and verify ([#684](https://github.com/hyperledger/aries-framework-javascript/issues/684)) ([5f91738](https://github.com/hyperledger/aries-framework-javascript/commit/5f91738337fac1efbbb4597e7724791e542f0762))
- **dids:** add did registrar ([#953](https://github.com/hyperledger/aries-framework-javascript/issues/953)) ([93f3c93](https://github.com/hyperledger/aries-framework-javascript/commit/93f3c93310f9dae032daa04a920b7df18e2f8a65))
- jsonld-credential support ([#718](https://github.com/hyperledger/aries-framework-javascript/issues/718)) ([ea34c47](https://github.com/hyperledger/aries-framework-javascript/commit/ea34c4752712efecf3367c5a5fc4b06e66c1e9d7))

## [0.2.5](https://github.com/hyperledger/aries-framework-javascript/compare/v0.2.4...v0.2.5) (2022-10-13)

**Note:** Version bump only for package @credo-ts/react-native

## [0.2.4](https://github.com/hyperledger/aries-framework-javascript/compare/v0.2.3...v0.2.4) (2022-09-10)

**Note:** Version bump only for package @credo-ts/react-native

## [0.2.3](https://github.com/hyperledger/aries-framework-javascript/compare/v0.2.2...v0.2.3) (2022-08-30)

**Note:** Version bump only for package @credo-ts/react-native

## [0.2.2](https://github.com/hyperledger/aries-framework-javascript/compare/v0.2.1...v0.2.2) (2022-07-15)

**Note:** Version bump only for package @credo-ts/react-native

## [0.2.1](https://github.com/hyperledger/aries-framework-javascript/compare/v0.2.0...v0.2.1) (2022-07-08)

**Note:** Version bump only for package @credo-ts/react-native

# [0.2.0](https://github.com/hyperledger/aries-framework-javascript/compare/v0.1.0...v0.2.0) (2022-06-24)

- chore!: update indy-sdk-react-native version to 0.2.0 (#754) ([4146778](https://github.com/hyperledger/aries-framework-javascript/commit/414677828be7f6c08fa02905d60d6555dc4dd438)), closes [#754](https://github.com/hyperledger/aries-framework-javascript/issues/754)

### Features

- add generic did resolver ([#554](https://github.com/hyperledger/aries-framework-javascript/issues/554)) ([8e03f35](https://github.com/hyperledger/aries-framework-javascript/commit/8e03f35f8e1cd02dac4df02d1f80f2c5a921dfef))
- add update assistant for storage migrations ([#690](https://github.com/hyperledger/aries-framework-javascript/issues/690)) ([c9bff93](https://github.com/hyperledger/aries-framework-javascript/commit/c9bff93cfac43c4ae2cbcad1f96c1a74cde39602))
- delete credential from wallet ([#691](https://github.com/hyperledger/aries-framework-javascript/issues/691)) ([abec3a2](https://github.com/hyperledger/aries-framework-javascript/commit/abec3a2c95815d1c54b22a6370222f024eefb060))
- indy revocation (prover & verifier) ([#592](https://github.com/hyperledger/aries-framework-javascript/issues/592)) ([fb19ff5](https://github.com/hyperledger/aries-framework-javascript/commit/fb19ff555b7c10c9409450dcd7d385b1eddf41ac))
- ledger connections happen on agent init in background ([#580](https://github.com/hyperledger/aries-framework-javascript/issues/580)) ([61695ce](https://github.com/hyperledger/aries-framework-javascript/commit/61695ce7737ffef363b60e341ae5b0e67e0e2c90))
- support wallet key rotation ([#672](https://github.com/hyperledger/aries-framework-javascript/issues/672)) ([5cd1598](https://github.com/hyperledger/aries-framework-javascript/commit/5cd1598b496a832c82f35a363fabe8f408abd439))

### BREAKING CHANGES

- indy-sdk-react-native has been updated to 0.2.0. The new version now depends on libindy version 1.16 and requires you to update the binaries in your react-native application. See the [indy-sdk-react-native](https://github.com/hyperledger/indy-sdk-react-native) repository for instructions on how to get the latest binaries for both iOS and Android.

# 0.1.0 (2021-12-23)

### Bug Fixes

- **core:** using query-string to parse URLs ([#457](https://github.com/hyperledger/aries-framework-javascript/issues/457)) ([78e5057](https://github.com/hyperledger/aries-framework-javascript/commit/78e505750557f296cc72ef19c0edd8db8e1eaa7d))
- monorepo release issues ([#386](https://github.com/hyperledger/aries-framework-javascript/issues/386)) ([89a628f](https://github.com/hyperledger/aries-framework-javascript/commit/89a628f7c3ea9e5730d2ba5720819ac6283ee404))

### Features

- **core:** d_m invitation parameter and invitation image ([#456](https://github.com/hyperledger/aries-framework-javascript/issues/456)) ([f92c322](https://github.com/hyperledger/aries-framework-javascript/commit/f92c322b97be4a4867a82c3a35159d6068951f0b))
- **core:** ledger module registerPublicDid implementation ([#398](https://github.com/hyperledger/aries-framework-javascript/issues/398)) ([5f2d512](https://github.com/hyperledger/aries-framework-javascript/commit/5f2d5126baed2ff58268c38755c2dbe75a654947))
