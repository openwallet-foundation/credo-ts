# Changelog

## 0.6.2

### Patch Changes

- a6e6f72: fix: anoncreds object registration with Cheqd and caching
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
  - @credo-ts/anoncreds@0.6.2

## 0.6.1

### Patch Changes

- Updated dependencies [9f60e1b]
  - @credo-ts/core@0.6.1
  - @credo-ts/anoncreds@0.6.1

## 0.6.0

### Minor Changes

- 879ed2c: deprecate node 18
- dfa1d6c: fix: handle string serviceEndpoint for DidCommV1Service.type
- b5fc7a6: - All `didcomm` package modules, APIs, models and services that are used for dependency injection now are prefixed with `DidComm` in its naming
  - DIDComm-related events have also changed their text string to make it possible to distinguish them from events triggered by other protocols
  - DIDComm credentials module API has been updated to use the term `credentialExchangeRecord` instead of `credentialRecord`, since it is usually confused with W3cCredentialRecords (and potentially other kind of credential records we might have). I took this opportunity to also update `declineOffer` options structure to match DIDComm proofs module API
  - DIDComm-related records were renamed, but their type is still the original one (e.g. `CredentialRecord`, `BasicMessageRecord`). Probably it's worth to take this major release to do the migration, but I'm afraid that it will be a bit risky, so I'm hesitating to do so or leaving it for some other major upgrade (if we think it's actually needed)
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

- 43148b4: Correctly populate DID Document Contexts For JsonLD Issuance
- 2cace9c: The following modules are not experimental anymore:
  - `DcqlModule`
  - `DifPresentationExchangeModule`
  - `SdJwtVcModule`
  - `MdocModule`
  - `TenantsModule`
  - `CheqdModule`
  - `DrpcModule`
  - `OpenId4VcModule`
  - `X509Module`
- 13cd8cb: feat: support node 22
- 589fc40: fix(cheqd): cheqd revocationRegistryDefinition resource name

  Creating two revocation registries with same name would lead to updating the resource. Adding credential definition tag in the resource name fixes this issue

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
- Updated dependencies [9f78a6e]
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
- Updated dependencies [645363d]
- Updated dependencies [e80794b]
- Updated dependencies [9f78a6e]
- Updated dependencies [9f78a6e]
- Updated dependencies [8baa7d7]
- Updated dependencies [d06669c]
- Updated dependencies [decbcac]
- Updated dependencies [9befbcb]
- Updated dependencies [6c8ab94]
- Updated dependencies [bc6f0c7]
- Updated dependencies [8be3d67]
- Updated dependencies [bd28bba]
- Updated dependencies [0d49804]
- Updated dependencies [27f971d]
  - @credo-ts/core@0.6.0
  - @credo-ts/anoncreds@0.6.0

## 0.5.13

### Patch Changes

- Updated dependencies [595c3d6]
  - @credo-ts/core@0.5.13
  - @credo-ts/anoncreds@0.5.13

## 0.5.12

### Patch Changes

- Updated dependencies [3c85565]
- Updated dependencies [3c85565]
- Updated dependencies [7d51fcb]
- Updated dependencies [9756a4a]
  - @credo-ts/core@0.5.12
  - @credo-ts/anoncreds@0.5.12

## 0.5.11

### Patch Changes

- 4485dc9: add cheqd api to allow creation of DID-Linked resources
  - @credo-ts/anoncreds@0.5.11
  - @credo-ts/core@0.5.11

## 0.5.10

### Patch Changes

- Updated dependencies [fa62b74]
  - @credo-ts/core@0.5.10
  - @credo-ts/anoncreds@0.5.10

## 0.5.9

### Patch Changes

- @credo-ts/anoncreds@0.5.9
- @credo-ts/core@0.5.9

## 0.5.8

### Patch Changes

- 1e9260a: add support for publishing AnonCreds revocation registry and statuslist for cheqd
- Updated dependencies [3819eb2]
- Updated dependencies [15d0a54]
- Updated dependencies [a5235e7]
  - @credo-ts/core@0.5.8
  - @credo-ts/anoncreds@0.5.8

## 0.5.7

### Patch Changes

- 8474776: Fix a build issue where importing cheqd pacakge would not work and give type errors
- Updated dependencies [352383f]
- Updated dependencies [1044c9d]
  - @credo-ts/core@0.5.7
  - @credo-ts/anoncreds@0.5.7

## 0.5.6

### Patch Changes

- 66e696d: Fix build issue causing error with importing packages in 0.5.5 release
- Updated dependencies [66e696d]
  - @credo-ts/anoncreds@0.5.6
  - @credo-ts/core@0.5.6

## 0.5.5

### Patch Changes

- d548fa4: feat: support new 'DIDCommMessaging' didcomm v2 service type (in addition to older 'DIDComm' service type)
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

## [0.5.3](https://github.com/openwallet-foundation/credo-ts/compare/v0.5.2...v0.5.3) (2024-05-01)

### Bug Fixes

- cheqd create from did document ([#1850](https://github.com/openwallet-foundation/credo-ts/issues/1850)) ([dcd028e](https://github.com/openwallet-foundation/credo-ts/commit/dcd028ea04863bf9bc93e6bd2f73c6d2a70f274b))

## [0.5.2](https://github.com/openwallet-foundation/credo-ts/compare/v0.5.1...v0.5.2) (2024-04-26)

### Bug Fixes

- udpate cheqd deps ([#1830](https://github.com/openwallet-foundation/credo-ts/issues/1830)) ([6b4b71b](https://github.com/openwallet-foundation/credo-ts/commit/6b4b71bf365262e8c2c9718547b60c44f2afc920))
- update cheqd to 2.4.2 ([#1817](https://github.com/openwallet-foundation/credo-ts/issues/1817)) ([8154df4](https://github.com/openwallet-foundation/credo-ts/commit/8154df45f45bd9da0c60abe3792ff0f081e81818))

## [0.5.1](https://github.com/openwallet-foundation/credo-ts/compare/v0.5.0...v0.5.1) (2024-03-28)

### Bug Fixes

- **cheqd:** do not crash agent if cheqd down ([#1808](https://github.com/openwallet-foundation/credo-ts/issues/1808)) ([842efd4](https://github.com/openwallet-foundation/credo-ts/commit/842efd4512748a0787ce331add394426b3b07943))

# [0.5.0](https://github.com/openwallet-foundation/credo-ts/compare/v0.4.2...v0.5.0) (2024-03-13)

### Features

- anoncreds w3c migration ([#1744](https://github.com/openwallet-foundation/credo-ts/issues/1744)) ([d7c2bbb](https://github.com/openwallet-foundation/credo-ts/commit/d7c2bbb4fde57cdacbbf1ed40c6bd1423f7ab015))
- **anoncreds:** issue revocable credentials ([#1427](https://github.com/openwallet-foundation/credo-ts/issues/1427)) ([c59ad59](https://github.com/openwallet-foundation/credo-ts/commit/c59ad59fbe63b6d3760d19030e0f95fb2ea8488a))
- **openid4vc:** persistance and events ([#1793](https://github.com/openwallet-foundation/credo-ts/issues/1793)) ([f4c386a](https://github.com/openwallet-foundation/credo-ts/commit/f4c386a6ccf8adb829cad30b81d524e6ffddb029))

## [0.4.2](https://github.com/hyperledger/aries-framework-javascript/compare/v0.4.1...v0.4.2) (2023-10-05)

### Bug Fixes

- **cheqd:** changed the name formatting to a encoded hex value ([#1574](https://github.com/hyperledger/aries-framework-javascript/issues/1574)) ([d299f55](https://github.com/hyperledger/aries-framework-javascript/commit/d299f55113cb4c59273ae9fbbb8773b6f0009192))
- update tsyringe for ts 5 support ([#1588](https://github.com/hyperledger/aries-framework-javascript/issues/1588)) ([296955b](https://github.com/hyperledger/aries-framework-javascript/commit/296955b3a648416ac6b502da05a10001920af222))

## [0.4.1](https://github.com/hyperledger/aries-framework-javascript/compare/v0.4.0...v0.4.1) (2023-08-28)

### Bug Fixes

- **cheqd:** make cosmos payer seed optional ([#1547](https://github.com/hyperledger/aries-framework-javascript/issues/1547)) ([9377378](https://github.com/hyperledger/aries-framework-javascript/commit/9377378b0124bf2f593342dba95a13ea5d8944c8))
- force did:key resolver/registrar presence ([#1535](https://github.com/hyperledger/aries-framework-javascript/issues/1535)) ([aaa13dc](https://github.com/hyperledger/aries-framework-javascript/commit/aaa13dc77d6d5133cd02e768e4173462fa65064a))

# [0.4.0](https://github.com/hyperledger/aries-framework-javascript/compare/v0.3.3...v0.4.0) (2023-06-03)

### Bug Fixes

- small updates to cheqd module and demo ([#1439](https://github.com/hyperledger/aries-framework-javascript/issues/1439)) ([61daf0c](https://github.com/hyperledger/aries-framework-javascript/commit/61daf0cb27de80a5e728e2e9dad13d729baf476c))

### Features

- Add cheqd demo and localnet for tests ([#1435](https://github.com/hyperledger/aries-framework-javascript/issues/1435)) ([1ffb011](https://github.com/hyperledger/aries-framework-javascript/commit/1ffb0111fc3db170e5623d350cb912b22027387a))
- Add cheqd-sdk module ([#1334](https://github.com/hyperledger/aries-framework-javascript/issues/1334)) ([b38525f](https://github.com/hyperledger/aries-framework-javascript/commit/b38525f3433e50418ea149949108b4218ac9ba2a))
- support for did:jwk and p-256, p-384, p-512 ([#1446](https://github.com/hyperledger/aries-framework-javascript/issues/1446)) ([700d3f8](https://github.com/hyperledger/aries-framework-javascript/commit/700d3f89728ce9d35e22519e505d8203a4c9031e))
