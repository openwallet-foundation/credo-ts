# Changelog

## 0.6.3

### Patch Changes

- Updated dependencies [73d2d59]
  - @credo-ts/core@0.6.3
  - @credo-ts/didcomm@0.6.3

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
- b5fc7a6: - All `didcomm` package modules, APIs, models and services that are used for dependency injection now are prefixed with `DidComm` in its naming
  - DIDComm-related events have also changed their text string to make it possible to distinguish them from events triggered by other protocols
  - DIDComm credentials module API has been updated to use the term `credentialExchangeRecord` instead of `credentialRecord`, since it is usually confused with W3cCredentialRecords (and potentially other kind of credential records we might have). I took this opportunity to also update `declineOffer` options structure to match DIDComm proofs module API
  - DIDComm-related records were renamed, but their type is still the original one (e.g. `CredentialRecord`, `BasicMessageRecord`). Probably it's worth to take this major release to do the migration, but I'm afraid that it will be a bit risky, so I'm hesitating to do so or leaving it for some other major upgrade (if we think it's actually needed)
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

- bc6f0c7: Add support for ESM module syntax.

  - Use `tsdown` to bundle for ESM -> tsdown is based on rust, so it should help with performance
  - Update to `vitest` since jest doesn't work well with ESM -> this should also help with performance
  - Simplify type checking -> just a single type check script instead of one for all packages. This should help with performance.

  NOTE: Since React Native bundles your code, the update to ESM should not cause issues. In addition all latest minor releases of Node 20 and 22 now support requiring ESM modules. This means that even if you project is still a CommonJS project, it can now depend on ESM modules. For this reason Credo is now fully an ESM module.

  Initially we added support for both CJS and ESM in parallel. However this caused issues with some libraries requiring the CJS output, and other the ESM output. Since Credo is only meant to be installed a single time for the dependency injection to work correctly, this resulted in unexpected behavior.

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

**Note:** Version bump only for package @credo-ts/action-menu

## [0.5.2](https://github.com/openwallet-foundation/credo-ts/compare/v0.5.1...v0.5.2) (2024-04-26)

**Note:** Version bump only for package @credo-ts/action-menu

## [0.5.1](https://github.com/openwallet-foundation/credo-ts/compare/v0.5.0...v0.5.1) (2024-03-28)

**Note:** Version bump only for package @credo-ts/action-menu

# [0.5.0](https://github.com/openwallet-foundation/credo-ts/compare/v0.4.2...v0.5.0) (2024-03-13)

### Features

- **openid4vc:** persistance and events ([#1793](https://github.com/openwallet-foundation/credo-ts/issues/1793)) ([f4c386a](https://github.com/openwallet-foundation/credo-ts/commit/f4c386a6ccf8adb829cad30b81d524e6ffddb029))

## [0.4.2](https://github.com/hyperledger/aries-framework-javascript/compare/v0.4.1...v0.4.2) (2023-10-05)

**Note:** Version bump only for package @credo-ts/action-menu

## [0.4.1](https://github.com/hyperledger/aries-framework-javascript/compare/v0.4.0...v0.4.1) (2023-08-28)

### Features

- oob without handhsake improvements and routing ([#1511](https://github.com/hyperledger/aries-framework-javascript/issues/1511)) ([9e69cf4](https://github.com/hyperledger/aries-framework-javascript/commit/9e69cf441a75bf7a3c5556cf59e730ee3fce8c28))

# [0.4.0](https://github.com/hyperledger/aries-framework-javascript/compare/v0.3.3...v0.4.0) (2023-06-03)

### Bug Fixes

- expose indy pool configs and action menu messages ([#1333](https://github.com/hyperledger/aries-framework-javascript/issues/1333)) ([518e5e4](https://github.com/hyperledger/aries-framework-javascript/commit/518e5e4dfb59f9c0457bfd233409e9f4b3c429ee))
- thread id improvements ([#1311](https://github.com/hyperledger/aries-framework-javascript/issues/1311)) ([229ed1b](https://github.com/hyperledger/aries-framework-javascript/commit/229ed1b9540ca0c9380b5cca6c763fefd6628960))

- refactor!: remove Dispatcher.registerMessageHandler (#1354) ([78ecf1e](https://github.com/hyperledger/aries-framework-javascript/commit/78ecf1ed959c9daba1c119d03f4596f1db16c57c)), closes [#1354](https://github.com/hyperledger/aries-framework-javascript/issues/1354)

### Features

- **openid4vc:** jwt format and more crypto ([#1472](https://github.com/hyperledger/aries-framework-javascript/issues/1472)) ([bd4932d](https://github.com/hyperledger/aries-framework-javascript/commit/bd4932d34f7314a6d49097b6460c7570e1ebc7a8))
- outbound message send via session ([#1335](https://github.com/hyperledger/aries-framework-javascript/issues/1335)) ([582c711](https://github.com/hyperledger/aries-framework-javascript/commit/582c711728db12b7d38a0be2e9fa78dbf31b34c6))

### BREAKING CHANGES

- `Dispatcher.registerMessageHandler` has been removed in favour of `MessageHandlerRegistry.registerMessageHandler`. If you want to register message handlers in an extension module, you can use directly `agentContext.dependencyManager.registerMessageHandlers`.

Signed-off-by: Ariel Gentile <gentilester@gmail.com>

## [0.3.3](https://github.com/hyperledger/aries-framework-javascript/compare/v0.3.2...v0.3.3) (2023-01-18)

### Bug Fixes

- fix typing issues with typescript 4.9 ([#1214](https://github.com/hyperledger/aries-framework-javascript/issues/1214)) ([087980f](https://github.com/hyperledger/aries-framework-javascript/commit/087980f1adf3ee0bc434ca9782243a62c6124444))

### Features

- **indy-sdk:** add indy-sdk package ([#1200](https://github.com/hyperledger/aries-framework-javascript/issues/1200)) ([9933b35](https://github.com/hyperledger/aries-framework-javascript/commit/9933b35a6aa4524caef8a885e71b742cd0d7186b))

## [0.3.2](https://github.com/hyperledger/aries-framework-javascript/compare/v0.3.1...v0.3.2) (2023-01-04)

**Note:** Version bump only for package @credo-ts/action-menu

## [0.3.1](https://github.com/hyperledger/aries-framework-javascript/compare/v0.3.0...v0.3.1) (2022-12-27)

**Note:** Version bump only for package @credo-ts/action-menu

# [0.3.0](https://github.com/hyperledger/aries-framework-javascript/compare/v0.2.5...v0.3.0) (2022-12-22)

- refactor!: rename Handler to MessageHandler (#1161) ([5e48696](https://github.com/hyperledger/aries-framework-javascript/commit/5e48696ec16d88321f225628e6cffab243718b4c)), closes [#1161](https://github.com/hyperledger/aries-framework-javascript/issues/1161)
- feat(action-menu)!: move to separate package (#1049) ([e0df0d8](https://github.com/hyperledger/aries-framework-javascript/commit/e0df0d884b1a7816c7c638406606e45f6e169ff4)), closes [#1049](https://github.com/hyperledger/aries-framework-javascript/issues/1049)

### BREAKING CHANGES

- Handler has been renamed to MessageHandler to be more descriptive, along with related types and methods. This means:

Handler is now MessageHandler
HandlerInboundMessage is now MessageHandlerInboundMessage
Dispatcher.registerHandler is now Dispatcher.registerMessageHandlers

- action-menu module has been removed from the core and moved to a separate package. To integrate it in an Agent instance, it can be injected in constructor like this:

```ts
const agent = new Agent({
  config: {
    /* config */
  },
  dependencies: agentDependencies,
  modules: {
    actionMenu: new ActionMenuModule(),
    /* other custom modules */
  },
});
```

Then, module API can be accessed in `agent.modules.actionMenu`.
