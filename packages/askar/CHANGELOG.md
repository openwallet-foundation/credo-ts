# Changelog

## 0.6.0

### Minor Changes

- 879ed2c: deprecate node 18
- 297d209: - Rely on Uint8Array instead of Buffer for internal key bytes representation
  - Remove dependency on external Big Number libraries
  - Default to use of uncompressed keys for Secp256k1, Secp256r1, Secp384r1 and Secp521r1
- e936068: when signing in Credo, it is now required to always reference a key id. For DIDs this is extracted from the DidRecord, and for JWKs (e.g. in holder binding) this is extracted form the `kid` of the JWK. For X509 certificates you need to make sure there is a key id attached to the certificate manually for now, since we don't have a X509 record like we have a DidRecord. For x509 certificates created before 0.6 you can use the legacy key id (`certificate.keyId = certificate.publicJwk.legacyKeyId`), for certificates created after 0.6 you need to manually store the key id and set it on the certificate after decoding.

  For this reason, we now require instances of X509 certificates where we used to require encoded certificates, to allow you to set the keyId on the certificate beforehand.

- e936068: The `Key` and `Jwk` classes have been removed in favour of a new `PublicJwk` class, and all APIs in Credo have been updated to use the new `PublicJwk` class. Leveraging Jwk as the base for all APIs provides more flexility and makes it easier to support key types where it's not always so easy to extract the raw public key bytes. In addition all the previous Jwk relatedfunctionality has been replaced with the new KMS jwk functionalty. For example `JwaSignatureAlgorithm` is now `Kms.KnownJwaSignatureAlgorithms`.
- e936068: The wallet API has been completely rewritten to be more generic, support multiple backends at the same time, support generic encrypting and decryption, support symmetric keys, and enable backends that use key ids rather than the public key to identify a key. This has resulted in significant breaking changes, and all usages of the wallet api should be updated to use the new `agent.kms` APIs. In addition the wallet is not available anymore on the agentContext. If you used this, instead inject the KMS API using `agentContext.resolve(Kms.KeyManagementApi)`.
- 9df09fa: - messagehandler should return undefined if it doesn't want to response with a message
- 70c849d: update target for tsc compiler to ES2020. Generally this should not have an impact for the supported environments (Node.JS / React Native). However this will have to be tested in React Native
- 897c834: DIDComm has been extracted out of the Core. This means that now all DIDComm related modules (e.g. proofs, credentials) must be explicitly added when creating an `Agent` instance. Therefore, their API will be accesable under `agent.modules.[moduleAPI]` instead of `agent.[moduleAPI]`. Some `Agent` DIDComm-related properties and methods where also moved to the API of a new DIDComm module (e.g. `agent.registerInboundTransport` turned into `agent.didcomm.registerInboundTransport`).

  **Example of DIDComm Agent**

  Previously:

  ```ts
       const config = {
        label: name,
        endpoints: ['https://myendpoint'],
        walletConfig: {
          id: name,
          key: name,
        },
      } satisfies InitConfig

      const agent = new Agent({
        config,
        dependencies: agentDependencies,
        modules: {
          connections: new DidCommConnectionsModule({
             autoAcceptConnections: true,
          })
        })
      this.agent.registerInboundTransport(new DidCommHttpInboundTransport({ port }))
      this.agent.registerOutboundTransport(new HttpOutboundTransport())

  ```

  Now:

  ```ts
       const config = {
        label: name,
        walletConfig: {
          id: name,
          key: name,
        },
      } satisfies InitConfig

      const agent = new Agent({
        config,
        dependencies: agentDependencies,
        modules: {
          ...getDefaultDidcommModules({ endpoints: ['https://myendpoint'] }),
          connections: new DidCommConnectionsModule({
             autoAcceptConnections: true,
          })
        })
      agent.didcomm.registerInboundTransport(new DidCommHttpInboundTransport({ port }))
      agent.didcomm.registerOutboundTransport(new DidCommHttpOutboundTransport())
  ```

- 81e3571: BREAKING CHANGE:

  `label` and `connectionImageUrl` have been dropped from Agent configuration. Therefore, it must be specified manually in all DIDComm connection establishment related methods. If you don't want to specify any label, just use an empty value.

  In the particular case of mediation provisioning through a `mediatorInvitationUrl`, the label will be always set to an empty value ('').

- 281471e: - depend on @openwallet-foundation/askar instead of @hyperledger/aries-askar
- e936068: The wallet config has been removed from the main agent config, to allow for more flexibility. Instead, each module can now define their own config for the storage and kms. For askar there is a new `store` property which must be provided on the askar module config where you can set the wallet id and key. It is also possible to disable the kms or storage for askar using `enableKms` and `enableStorage`.
- 425941e: update askar library to 0.4.0, enabling 16KB page size support for Android
- bc6f0c7: Add support for ESM module syntax.

  - Use `tsdown` to bundle for ESM -> tsdown is based on rust, so it should help with performance
  - Update to `vitest` since jest doesn't work well with ESM -> this should also help with performance
  - Simplify type checking -> just a single type check script instead of one for all packages. This should help with performance.

  NOTE: Since React Native bundles your code, the update to ESM should not cause issues. In addition all latest minor releases of Node 20 and 22 now support requiring ESM modules. This means that even if you project is still a CommonJS project, it can now depend on ESM modules. For this reason Credo is now fully an ESM module.

  Initially we added support for both CJS and ESM in parallel. However this caused issues with some libraries requiring the CJS output, and other the ESM output. Since Credo is only meant to be installed a single time for the dependency injection to work correctly, this resulted in unexpected behavior.

### Patch Changes

- 1810764: fix: incorrect key alg for didcomm. With the introduction of the new KMS API, the XC20P algorithm was used instead of the C20P. This is not resolved and tests have been added to ensure interop with previous Credo versions.
- 297d209: - Remove usage of Big Number libraries and rely on native implementations
  - By default rely on uncompressed keys instead of compressed (for P256, P384, P521 and K256)
  - Utilze Uint8Array more instead of Buffer (i.e. for internally representing a key)
- 13cd8cb: feat: support node 22
- a666e94: Export Askar errors.
- 9befbcb: chore: update askar library to fix a memory leak
- 1bee6b7: fix: wrap askar operations with Uint8array to fix encoding issues in react native
- 9f78a6e: allow A128GCM as allowed value for ECDH encryption
- 0c274fe: feat: support Ed25519 as an algorithm identifier for JWA
- a53fc54: feat: support A128CBC-HS256 encryption algorithm for JWE
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

- 9756a4a: feat: add direct ecdh-es jwe encryption/decryption
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

**Note:** Version bump only for package @credo-ts/askar

## [0.5.2](https://github.com/openwallet-foundation/credo-ts/compare/v0.5.1...v0.5.2) (2024-04-26)

### Bug Fixes

- node-ffi-napi compatibility ([#1821](https://github.com/openwallet-foundation/credo-ts/issues/1821)) ([81d351b](https://github.com/openwallet-foundation/credo-ts/commit/81d351bc9d4d508ebfac9e7f2b2f10276ab1404a))

## [0.5.1](https://github.com/openwallet-foundation/credo-ts/compare/v0.5.0...v0.5.1) (2024-03-28)

**Note:** Version bump only for package @credo-ts/askar

# [0.5.0](https://github.com/openwallet-foundation/credo-ts/compare/v0.4.2...v0.5.0) (2024-03-13)

### Features

- add support for key type k256 ([#1722](https://github.com/openwallet-foundation/credo-ts/issues/1722)) ([22d5bff](https://github.com/openwallet-foundation/credo-ts/commit/22d5bffc939f6644f324f6ddba4c8269212e9dc4))
- **openid4vc:** persistance and events ([#1793](https://github.com/openwallet-foundation/credo-ts/issues/1793)) ([f4c386a](https://github.com/openwallet-foundation/credo-ts/commit/f4c386a6ccf8adb829cad30b81d524e6ffddb029))
- optional backup on storage migration ([#1745](https://github.com/openwallet-foundation/credo-ts/issues/1745)) ([81ff63c](https://github.com/openwallet-foundation/credo-ts/commit/81ff63ccf7c71eccf342899d298a780d66045534))
- **tenants:** support for tenant storage migration ([#1747](https://github.com/openwallet-foundation/credo-ts/issues/1747)) ([12c617e](https://github.com/openwallet-foundation/credo-ts/commit/12c617efb45d20fda8965b9b4da24c92e975c9a2))

## [0.4.2](https://github.com/hyperledger/aries-framework-javascript/compare/v0.4.1...v0.4.2) (2023-10-05)

### Bug Fixes

- **askar:** throw error if imported wallet exists ([#1593](https://github.com/hyperledger/aries-framework-javascript/issues/1593)) ([c2bb2a5](https://github.com/hyperledger/aries-framework-javascript/commit/c2bb2a52f10add35de883c9a27716db01b9028df))
- update tsyringe for ts 5 support ([#1588](https://github.com/hyperledger/aries-framework-javascript/issues/1588)) ([296955b](https://github.com/hyperledger/aries-framework-javascript/commit/296955b3a648416ac6b502da05a10001920af222))

## [0.4.1](https://github.com/hyperledger/aries-framework-javascript/compare/v0.4.0...v0.4.1) (2023-08-28)

### Bug Fixes

- **askar:** in memory wallet creation ([#1498](https://github.com/hyperledger/aries-framework-javascript/issues/1498)) ([4a158e6](https://github.com/hyperledger/aries-framework-javascript/commit/4a158e64b97595be0733d4277c28c462bd47c908))

### Features

- support askar profiles for multi-tenancy ([#1538](https://github.com/hyperledger/aries-framework-javascript/issues/1538)) ([e448a2a](https://github.com/hyperledger/aries-framework-javascript/commit/e448a2a58dddff2cdf80c4549ea2d842a54b43d1))

# [0.4.0](https://github.com/hyperledger/aries-framework-javascript/compare/v0.3.3...v0.4.0) (2023-06-03)

### Bug Fixes

- **askar:** anoncrypt messages unpacking ([#1332](https://github.com/hyperledger/aries-framework-javascript/issues/1332)) ([1c6aeae](https://github.com/hyperledger/aries-framework-javascript/commit/1c6aeae31ac57e83f4059f3dba35ccb1ca36926e))
- **askar:** custom error handling ([#1372](https://github.com/hyperledger/aries-framework-javascript/issues/1372)) ([c72ba14](https://github.com/hyperledger/aries-framework-javascript/commit/c72ba149bad3a4596f5818b28516f6286b9088bf))
- **askar:** default key derivation method ([#1420](https://github.com/hyperledger/aries-framework-javascript/issues/1420)) ([7b59629](https://github.com/hyperledger/aries-framework-javascript/commit/7b5962917488cfd0c5adc170d3c3fc64aa82ef2c))
- **askar:** generate nonce suitable for anoncreds ([#1295](https://github.com/hyperledger/aries-framework-javascript/issues/1295)) ([ecce0a7](https://github.com/hyperledger/aries-framework-javascript/commit/ecce0a71578f45f55743198a1f3699bd257dc74b))
- imports from core ([#1303](https://github.com/hyperledger/aries-framework-javascript/issues/1303)) ([3e02227](https://github.com/hyperledger/aries-framework-javascript/commit/3e02227a7b23677e9886eb1c03d1a3ec154947a9))
- issuance with unqualified identifiers ([#1431](https://github.com/hyperledger/aries-framework-javascript/issues/1431)) ([de90caf](https://github.com/hyperledger/aries-framework-javascript/commit/de90cafb8d12b7a940f881184cd745c4b5043cbc))
- seed and private key validation and return type in registrars ([#1324](https://github.com/hyperledger/aries-framework-javascript/issues/1324)) ([c0e5339](https://github.com/hyperledger/aries-framework-javascript/commit/c0e5339edfa32df92f23fb9c920796b4b59adf52))
- set updateAt on records when updating a record ([#1272](https://github.com/hyperledger/aries-framework-javascript/issues/1272)) ([2669d7d](https://github.com/hyperledger/aries-framework-javascript/commit/2669d7dd3d7c0ddfd1108dfd65e6115dd3418500))
- small issues with migration and WAL files ([#1443](https://github.com/hyperledger/aries-framework-javascript/issues/1443)) ([83cf387](https://github.com/hyperledger/aries-framework-javascript/commit/83cf387fa52bb51d8adb2d5fedc5111994d4dde1))
- small updates to cheqd module and demo ([#1439](https://github.com/hyperledger/aries-framework-javascript/issues/1439)) ([61daf0c](https://github.com/hyperledger/aries-framework-javascript/commit/61daf0cb27de80a5e728e2e9dad13d729baf476c))

- feat!: add data, cache and temp dirs to FileSystem (#1306) ([ff5596d](https://github.com/hyperledger/aries-framework-javascript/commit/ff5596d0631e93746494c017797d0191b6bdb0b1)), closes [#1306](https://github.com/hyperledger/aries-framework-javascript/issues/1306)

### Features

- 0.4.0 migration script ([#1392](https://github.com/hyperledger/aries-framework-javascript/issues/1392)) ([bc5455f](https://github.com/hyperledger/aries-framework-javascript/commit/bc5455f7b42612a2b85e504bc6ddd36283a42bfa))
- add initial askar package ([#1211](https://github.com/hyperledger/aries-framework-javascript/issues/1211)) ([f18d189](https://github.com/hyperledger/aries-framework-javascript/commit/f18d1890546f7d66571fe80f2f3fc1fead1cd4c3))
- **anoncreds:** legacy indy proof format service ([#1283](https://github.com/hyperledger/aries-framework-javascript/issues/1283)) ([c72fd74](https://github.com/hyperledger/aries-framework-javascript/commit/c72fd7416f2c1bc0497a84036e16adfa80585e49))
- **askar:** import/export wallet support for SQLite ([#1377](https://github.com/hyperledger/aries-framework-javascript/issues/1377)) ([19cefa5](https://github.com/hyperledger/aries-framework-javascript/commit/19cefa54596a4e4848bdbe89306a884a5ce2e991))
- basic message pthid/thid support ([#1381](https://github.com/hyperledger/aries-framework-javascript/issues/1381)) ([f27fb99](https://github.com/hyperledger/aries-framework-javascript/commit/f27fb9921e11e5bcd654611d97d9fa1c446bc2d5))
- indy sdk aries askar migration script ([#1289](https://github.com/hyperledger/aries-framework-javascript/issues/1289)) ([4a6b99c](https://github.com/hyperledger/aries-framework-javascript/commit/4a6b99c617de06edbaf1cb07c8adfa8de9b3ec15))
- **openid4vc:** jwt format and more crypto ([#1472](https://github.com/hyperledger/aries-framework-javascript/issues/1472)) ([bd4932d](https://github.com/hyperledger/aries-framework-javascript/commit/bd4932d34f7314a6d49097b6460c7570e1ebc7a8))
- support for did:jwk and p-256, p-384, p-512 ([#1446](https://github.com/hyperledger/aries-framework-javascript/issues/1446)) ([700d3f8](https://github.com/hyperledger/aries-framework-javascript/commit/700d3f89728ce9d35e22519e505d8203a4c9031e))

### BREAKING CHANGES

- Agent-produced files will now be divided in different system paths depending on their nature: data, temp and cache. Previously, they were located at a single location, defaulting to a temporary directory.

If you specified a custom path in `FileSystem` object constructor, you now must provide an object containing `baseDataPath`, `baseTempPath` and `baseCachePath`. They can point to the same path, although it's recommended to specify different path to avoid future file clashes.
