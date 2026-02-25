# Changelog

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
  - @credo-ts/didcomm@0.6.2

## 0.6.1

### Patch Changes

- Updated dependencies [9f60e1b]
- Updated dependencies [251cbe5]
  - @credo-ts/core@0.6.1
  - @credo-ts/didcomm@0.6.1

## 0.6.0

### Minor Changes

- 879ed2c: deprecate node 18
- e936068: when signing in Credo, it is now required to always reference a key id. For DIDs this is extracted from the DidRecord, and for JWKs (e.g. in holder binding) this is extracted form the `kid` of the JWK. For X509 certificates you need to make sure there is a key id attached to the certificate manually for now, since we don't have a X509 record like we have a DidRecord. For x509 certificates created before 0.6 you can use the legacy key id (`certificate.keyId = certificate.publicJwk.legacyKeyId`), for certificates created after 0.6 you need to manually store the key id and set it on the certificate after decoding.

  For this reason, we now require instances of X509 certificates where we used to require encoded certificates, to allow you to set the keyId on the certificate beforehand.

- e936068: The `Key` and `Jwk` classes have been removed in favour of a new `PublicJwk` class, and all APIs in Credo have been updated to use the new `PublicJwk` class. Leveraging Jwk as the base for all APIs provides more flexility and makes it easier to support key types where it's not always so easy to extract the raw public key bytes. In addition all the previous Jwk relatedfunctionality has been replaced with the new KMS jwk functionalty. For example `JwaSignatureAlgorithm` is now `Kms.KnownJwaSignatureAlgorithms`.
- e936068: The wallet API has been completely rewritten to be more generic, support multiple backends at the same time, support generic encrypting and decryption, support symmetric keys, and enable backends that use key ids rather than the public key to identify a key. This has resulted in significant breaking changes, and all usages of the wallet api should be updated to use the new `agent.kms` APIs. In addition the wallet is not available anymore on the agentContext. If you used this, instead inject the KMS API using `agentContext.resolve(Kms.KeyManagementApi)`.
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

- bc6f0c7: Add support for ESM module syntax.

  - Use `tsdown` to bundle for ESM -> tsdown is based on rust, so it should help with performance
  - Update to `vitest` since jest doesn't work well with ESM -> this should also help with performance
  - Simplify type checking -> just a single type check script instead of one for all packages. This should help with performance.

  NOTE: Since React Native bundles your code, the update to ESM should not cause issues. In addition all latest minor releases of Node 20 and 22 now support requiring ESM modules. This means that even if you project is still a CommonJS project, it can now depend on ESM modules. For this reason Credo is now fully an ESM module.

  Initially we added support for both CJS and ESM in parallel. However this caused issues with some libraries requiring the CJS output, and other the ESM output. Since Credo is only meant to be installed a single time for the dependency injection to work correctly, this resulted in unexpected behavior.

### Patch Changes

- 13cd8cb: feat: support node 22
- 0c274fe: feat: support Ed25519 as an algorithm identifier for JWA
- Updated dependencies [55318b2]
- Updated dependencies [e936068]
- Updated dependencies [43148b4]
- Updated dependencies [2d10ec3]
- Updated dependencies [6d83136]
- Updated dependencies [312a7b2]
- Updated dependencies [1495177]
- Updated dependencies [1810764]
- Updated dependencies [2cace9c]
- Updated dependencies [879ed2c]
- Updated dependencies [297d209]
- Updated dependencies [2312bb8]
- Updated dependencies [11827cc]
- Updated dependencies [9f78a6e]
- Updated dependencies [297d209]
- Updated dependencies [652ade8]
- Updated dependencies [0500765]
- Updated dependencies [2cace9c]
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
- Updated dependencies [b5fc7a6]
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
- Updated dependencies [0d877f5]
- Updated dependencies [e936068]
- Updated dependencies [2d10ec3]
- Updated dependencies [09ea6e3]
- Updated dependencies [0500765]
- Updated dependencies [1a4182e]
- Updated dependencies [8be3d67]
- Updated dependencies [a4f443b]
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
- Updated dependencies [5ff7bba]
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
- Updated dependencies [11545ce]
- Updated dependencies [645363d]
- Updated dependencies [e80794b]
- Updated dependencies [9f78a6e]
- Updated dependencies [9f78a6e]
- Updated dependencies [8baa7d7]
- Updated dependencies [d06669c]
- Updated dependencies [decbcac]
- Updated dependencies [6c8ab94]
- Updated dependencies [bc6f0c7]
- Updated dependencies [676af7f]
- Updated dependencies [d9e04db]
- Updated dependencies [d6086e9]
- Updated dependencies [8be3d67]
- Updated dependencies [bd28bba]
- Updated dependencies [0d49804]
- Updated dependencies [27f971d]
  - @credo-ts/core@0.6.0
  - @credo-ts/didcomm@0.6.0

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

**Note:** Version bump only for package @credo-ts/node

## [0.5.2](https://github.com/openwallet-foundation/credo-ts/compare/v0.5.1...v0.5.2) (2024-04-26)

### Bug Fixes

- node-ffi-napi compatibility ([#1821](https://github.com/openwallet-foundation/credo-ts/issues/1821)) ([81d351b](https://github.com/openwallet-foundation/credo-ts/commit/81d351bc9d4d508ebfac9e7f2b2f10276ab1404a))

## [0.5.1](https://github.com/openwallet-foundation/credo-ts/compare/v0.5.0...v0.5.1) (2024-03-28)

### Bug Fixes

- import of websocket ([#1804](https://github.com/openwallet-foundation/credo-ts/issues/1804)) ([48b31ae](https://github.com/openwallet-foundation/credo-ts/commit/48b31ae9229cd188defb0ed3b4e64b0346013f3d))

# [0.5.0](https://github.com/openwallet-foundation/credo-ts/compare/v0.4.2...v0.5.0) (2024-03-13)

**Note:** Version bump only for package @credo-ts/node

## [0.4.2](https://github.com/hyperledger/aries-framework-javascript/compare/v0.4.1...v0.4.2) (2023-10-05)

### Bug Fixes

- log and throw on WebSocket sending errors ([#1573](https://github.com/hyperledger/aries-framework-javascript/issues/1573)) ([11050af](https://github.com/hyperledger/aries-framework-javascript/commit/11050afc7965adfa9b00107ba34abfbe3afaf874))

## [0.4.1](https://github.com/hyperledger/aries-framework-javascript/compare/v0.4.0...v0.4.1) (2023-08-28)

### Bug Fixes

- **samples:** mediator wallet and http transport ([#1508](https://github.com/hyperledger/aries-framework-javascript/issues/1508)) ([04a8058](https://github.com/hyperledger/aries-framework-javascript/commit/04a80589b19725fb493e51e52a7345915b2c7341))

# [0.4.0](https://github.com/hyperledger/aries-framework-javascript/compare/v0.3.3...v0.4.0) (2023-06-03)

### Bug Fixes

- return HTTP 415 if unsupported content type ([#1313](https://github.com/hyperledger/aries-framework-javascript/issues/1313)) ([122cdde](https://github.com/hyperledger/aries-framework-javascript/commit/122cdde6982174a8e9cf70ef26a1393cb3912066))

- feat!: add data, cache and temp dirs to FileSystem (#1306) ([ff5596d](https://github.com/hyperledger/aries-framework-javascript/commit/ff5596d0631e93746494c017797d0191b6bdb0b1)), closes [#1306](https://github.com/hyperledger/aries-framework-javascript/issues/1306)

### Features

- add initial askar package ([#1211](https://github.com/hyperledger/aries-framework-javascript/issues/1211)) ([f18d189](https://github.com/hyperledger/aries-framework-javascript/commit/f18d1890546f7d66571fe80f2f3fc1fead1cd4c3))
- **anoncreds:** legacy indy proof format service ([#1283](https://github.com/hyperledger/aries-framework-javascript/issues/1283)) ([c72fd74](https://github.com/hyperledger/aries-framework-javascript/commit/c72fd7416f2c1bc0497a84036e16adfa80585e49))
- **askar:** import/export wallet support for SQLite ([#1377](https://github.com/hyperledger/aries-framework-javascript/issues/1377)) ([19cefa5](https://github.com/hyperledger/aries-framework-javascript/commit/19cefa54596a4e4848bdbe89306a884a5ce2e991))

### BREAKING CHANGES

- Agent-produced files will now be divided in different system paths depending on their nature: data, temp and cache. Previously, they were located at a single location, defaulting to a temporary directory.

If you specified a custom path in `FileSystem` object constructor, you now must provide an object containing `baseDataPath`, `baseTempPath` and `baseCachePath`. They can point to the same path, although it's recommended to specify different path to avoid future file clashes.

## [0.3.3](https://github.com/hyperledger/aries-framework-javascript/compare/v0.3.2...v0.3.3) (2023-01-18)

### Bug Fixes

- fix typing issues with typescript 4.9 ([#1214](https://github.com/hyperledger/aries-framework-javascript/issues/1214)) ([087980f](https://github.com/hyperledger/aries-framework-javascript/commit/087980f1adf3ee0bc434ca9782243a62c6124444))

## [0.3.2](https://github.com/hyperledger/aries-framework-javascript/compare/v0.3.1...v0.3.2) (2023-01-04)

**Note:** Version bump only for package @credo-ts/node

## [0.3.1](https://github.com/hyperledger/aries-framework-javascript/compare/v0.3.0...v0.3.1) (2022-12-27)

**Note:** Version bump only for package @credo-ts/node

# [0.3.0](https://github.com/hyperledger/aries-framework-javascript/compare/v0.2.5...v0.3.0) (2022-12-22)

- refactor!: add agent context (#920) ([b47cfcb](https://github.com/hyperledger/aries-framework-javascript/commit/b47cfcba1450cd1d6839bf8192d977bfe33f1bb0)), closes [#920](https://github.com/hyperledger/aries-framework-javascript/issues/920)

### Features

- add agent context provider ([#921](https://github.com/hyperledger/aries-framework-javascript/issues/921)) ([a1b1e5a](https://github.com/hyperledger/aries-framework-javascript/commit/a1b1e5a22fd4ab9ef593b5cd7b3c710afcab3142))
- specify httpinboundtransport path ([#1115](https://github.com/hyperledger/aries-framework-javascript/issues/1115)) ([03cdf39](https://github.com/hyperledger/aries-framework-javascript/commit/03cdf397b61253d2eb20694049baf74843b7ed92))

### BREAKING CHANGES

- To make AFJ multi-tenancy ready, all services and repositories have been made stateless. A new `AgentContext` is introduced that holds the current context, which is passed to each method call. The public API hasn't been affected, but due to the large impact of this change it is marked as breaking.

## [0.2.5](https://github.com/hyperledger/aries-framework-javascript/compare/v0.2.4...v0.2.5) (2022-10-13)

**Note:** Version bump only for package @credo-ts/node

## [0.2.4](https://github.com/hyperledger/aries-framework-javascript/compare/v0.2.3...v0.2.4) (2022-09-10)

**Note:** Version bump only for package @credo-ts/node

## [0.2.3](https://github.com/hyperledger/aries-framework-javascript/compare/v0.2.2...v0.2.3) (2022-08-30)

**Note:** Version bump only for package @credo-ts/node

## [0.2.2](https://github.com/hyperledger/aries-framework-javascript/compare/v0.2.1...v0.2.2) (2022-07-15)

**Note:** Version bump only for package @credo-ts/node

## [0.2.1](https://github.com/hyperledger/aries-framework-javascript/compare/v0.2.0...v0.2.1) (2022-07-08)

### Features

- initial plugin api ([#907](https://github.com/hyperledger/aries-framework-javascript/issues/907)) ([6d88aa4](https://github.com/hyperledger/aries-framework-javascript/commit/6d88aa4537ab2a9494ffea8cdfb4723cf915f291))

# [0.2.0](https://github.com/hyperledger/aries-framework-javascript/compare/v0.1.0...v0.2.0) (2022-06-24)

### Bug Fixes

- close session early if no return route ([#715](https://github.com/hyperledger/aries-framework-javascript/issues/715)) ([2e65408](https://github.com/hyperledger/aries-framework-javascript/commit/2e6540806f2d67bef16004f6e8398c5bf7a05bcf))
- **node:** allow to import node package without postgres ([#757](https://github.com/hyperledger/aries-framework-javascript/issues/757)) ([59e1058](https://github.com/hyperledger/aries-framework-javascript/commit/59e10589acee987fb46f9cbaa3583ba8dcd70b87))
- **node:** only send 500 if no headers sent yet ([#857](https://github.com/hyperledger/aries-framework-javascript/issues/857)) ([4be8f82](https://github.com/hyperledger/aries-framework-javascript/commit/4be8f82c214f99538eaa0fd0aac5a8f7a6e1dd6b))

### Features

- **core:** add support for postgres wallet type ([#699](https://github.com/hyperledger/aries-framework-javascript/issues/699)) ([83ff0f3](https://github.com/hyperledger/aries-framework-javascript/commit/83ff0f36401cbf6e95c0a1ceb9fa921a82dc6830))
- indy revocation (prover & verifier) ([#592](https://github.com/hyperledger/aries-framework-javascript/issues/592)) ([fb19ff5](https://github.com/hyperledger/aries-framework-javascript/commit/fb19ff555b7c10c9409450dcd7d385b1eddf41ac))

# 0.1.0 (2021-12-23)

### Bug Fixes

- **node:** node v12 support for is-indy-installed ([#542](https://github.com/hyperledger/aries-framework-javascript/issues/542)) ([17e9157](https://github.com/hyperledger/aries-framework-javascript/commit/17e9157479d6bba90c2a94bce64697d7f65fac96))

### Features

- add multiple inbound transports ([#433](https://github.com/hyperledger/aries-framework-javascript/issues/433)) ([56cb9f2](https://github.com/hyperledger/aries-framework-javascript/commit/56cb9f2202deb83b3c133905f21651bfefcb63f7))
- break out indy wallet, better indy handling ([#396](https://github.com/hyperledger/aries-framework-javascript/issues/396)) ([9f1a4a7](https://github.com/hyperledger/aries-framework-javascript/commit/9f1a4a754a61573ce3fee78d52615363c7e25d58))
- **core:** connection-less issuance and verification ([#359](https://github.com/hyperledger/aries-framework-javascript/issues/359)) ([fb46ade](https://github.com/hyperledger/aries-framework-javascript/commit/fb46ade4bc2dd4f3b63d4194bb170d2f329562b7))
- **core:** support multiple indy ledgers ([#474](https://github.com/hyperledger/aries-framework-javascript/issues/474)) ([47149bc](https://github.com/hyperledger/aries-framework-javascript/commit/47149bc5742456f4f0b75e0944ce276972e645b8))
- **node:** add http and ws inbound transport ([#392](https://github.com/hyperledger/aries-framework-javascript/issues/392)) ([34a6ff2](https://github.com/hyperledger/aries-framework-javascript/commit/34a6ff2699197b9d525422a0a405e241582a476c))
- **node:** add is-indy-installed command ([#510](https://github.com/hyperledger/aries-framework-javascript/issues/510)) ([e50b821](https://github.com/hyperledger/aries-framework-javascript/commit/e50b821343970d299a4cacdcba3a051893524ed6))
