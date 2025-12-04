# Changelog

## 0.6.0

### Minor Changes

- 879ed2c: deprecate node 18
- 297d209: - Rely on Uint8Array instead of Buffer for internal key bytes representation
  - Remove dependency on external Big Number libraries
  - Default to use of uncompressed keys for Secp256k1, Secp256r1, Secp384r1 and Secp521r1
- 2cace9c: refactor: remove support for DIDComm linked attachments. The functionality was not working correctly anymore, and only supported for the deprecated v1 issuance protocol
- b5fc7a6: - All `didcomm` package modules, APIs, models and services that are used for dependency injection now are prefixed with `DidComm` in its naming
  - DIDComm-related events have also changed their text string to make it possible to distinguish them from events triggered by other protocols
  - DIDComm credentials module API has been updated to use the term `credentialExchangeRecord` instead of `credentialRecord`, since it is usually confused with W3cCredentialRecords (and potentially other kind of credential records we might have). I took this opportunity to also update `declineOffer` options structure to match DIDComm proofs module API
  - DIDComm-related records were renamed, but their type is still the original one (e.g. `CredentialRecord`, `BasicMessageRecord`). Probably it's worth to take this major release to do the migration, but I'm afraid that it will be a bit risky, so I'm hesitating to do so or leaving it for some other major upgrade (if we think it's actually needed)
- e936068: when signing in Credo, it is now required to always reference a key id. For DIDs this is extracted from the DidRecord, and for JWKs (e.g. in holder binding) this is extracted form the `kid` of the JWK. For X509 certificates you need to make sure there is a key id attached to the certificate manually for now, since we don't have a X509 record like we have a DidRecord. For x509 certificates created before 0.6 you can use the legacy key id (`certificate.keyId = certificate.publicJwk.legacyKeyId`), for certificates created after 0.6 you need to manually store the key id and set it on the certificate after decoding.

  For this reason, we now require instances of X509 certificates where we used to require encoded certificates, to allow you to set the keyId on the certificate beforehand.

- 9f78a6e: upgrade anoncreds wrapper to 0.3
- 2cace9c: The following modules are marked as deprecated and will be removed in version 0.7 of Credo:
  - DIDComm Connection Protocol V1 - Update to the DID Exchange protocol instead.
  - DIDComm V1 Credential Protocol - Update to the DIDComm V2 Credential Protocol instead.
  - DIDComm Legacy Indy Credential Format - Update to the DIDComm AnonCreds Credential Format.
  - DIDComm V1 Proof Protocol - Update to the DIDComm V2 Proof Protocol instead.
  - DIDComm Legacy Indy Proof Format - Update to the DIDComm AnonCreds Proof Format.
- e936068: The `Key` and `Jwk` classes have been removed in favour of a new `PublicJwk` class, and all APIs in Credo have been updated to use the new `PublicJwk` class. Leveraging Jwk as the base for all APIs provides more flexility and makes it easier to support key types where it's not always so easy to extract the raw public key bytes. In addition all the previous Jwk relatedfunctionality has been replaced with the new KMS jwk functionalty. For example `JwaSignatureAlgorithm` is now `Kms.KnownJwaSignatureAlgorithms`.
- 0500765: **BREAKING**: Refactored credential storage to support batch credentials with KMS key tracking

  This is a significant change to how credentials are stored and accessed in Credo. The main user-facing changes are:

  ### Credential Records now support multiple credential instances

  All credential record types (`W3cCredentialRecord`, `W3cV2CredentialRecord`, `SdJwtVcRecord`, `MdocRecord`) now support storing multiple credential instances in a single record. This enables:

  - Batch issuance workflows where multiple credentials are issued together
  - Tracking which KMS key was used to sign each credential instance
  - Better support for credential refresh and reissuance scenarios

  ### API Changes

  **Storing Credentials:**

  - The `storeCredential()` method now expects a `record` parameter instead of a `credential` parameter
  - You must create the record first using `W3cCredentialRecord.fromCredential()` or similar constructors. Store credential expecting a record allows the OpenID4VC module to already return the credential record with the linked kms keys. In the future the OpenID4VC display metadata will also be added to the record automatically.

  ```typescript
  // Before
  await agent.w3cCredentials.storeCredential({ credential });

  // After
  const record = W3cCredentialRecord.fromCredential(credential);
  await agent.w3cCredentials.store({ record });
  ```

  **Accessing Credentials:**

  - Records now use `firstCredential` property to access the primary credential instead of `credential`
  - Use `credentialInstances` array to access all instances in a batch record
  - The `multiInstanceState` property tracks the state of credential instances:
    - `SingleInstanceUnused`: Single instance that has never been used
    - `SingleInstanceUsed`: Single instance that has been used at least once
    - `MultiInstanceFirstUnused`: Credential was originally a multi instance credential, where the first instance is unused.
    - `MultiInstanceFirstUsed`: Credential was originally a multi instance credential, where the first instance is used. It may still have other instances that are unused (which can be detected if the length of credentialInstances > 1)

  ```typescript
  // Before
  const credential = record.credential;

  // After
  const credential = record.firstCredential;

  // Check credential state
  if (
    record.multiInstanceState ===
    CredentialMultiInstanceState.MultiInstanceLastUnused
  ) {
    // Has unused instances available
  }
  ```

  ### KMS Key Tracking

  Credential instances now track which KMS key was used to sign them:

  - Each credential instance can have an associated `kmsKeyId`
  - This enables key rotation and multi-tenant scenarios where different keys are used
  - The KMS key ID is stored in the credential record and synced with credential metadata

  ### Storage Service Updates

  - Added `lockedUpdate()` method to storage services for atomic updates with record locking
  - Prevents race conditions when updating records concurrently
  - Throws error if trying to update a record that has been modified since it was loaded

  ### Migration Notes

  If you have custom code that:

  - Stores credentials using `storeCredential()` - update to use the new `store()` API
  - Accesses `record.credential` - update to use `record.firstCredential`
  - Directly constructs credential records - ensure you use the proper constructors with `credentialInstances` array

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

- bc6f0c7: Add support for ESM module syntax.

  - Use `tsdown` to bundle for ESM -> tsdown is based on rust, so it should help with performance
  - Update to `vitest` since jest doesn't work well with ESM -> this should also help with performance
  - Simplify type checking -> just a single type check script instead of one for all packages. This should help with performance.

  NOTE: Since React Native bundles your code, the update to ESM should not cause issues. In addition all latest minor releases of Node 20 and 22 now support requiring ESM modules. This means that even if you project is still a CommonJS project, it can now depend on ESM modules. For this reason Credo is now fully an ESM module.

  Initially we added support for both CJS and ESM in parallel. However this caused issues with some libraries requiring the CJS output, and other the ESM output. Since Credo is only meant to be installed a single time for the dependency injection to work correctly, this resulted in unexpected behavior.

### Patch Changes

- 297d209: - Remove usage of Big Number libraries and rely on native implementations
  - By default rely on uncompressed keys instead of compressed (for P256, P384, P521 and K256)
  - Utilze Uint8Array more instead of Buffer (i.e. for internally representing a key)
- 13cd8cb: feat: support node 22
- 5ff7bba: feat(didcomm): allow sending revocation notifications without the need of keeping the related Credential Exchange record
- d06669c: feat: support DIDComm Out of Band proof proposals
- 9befbcb: chore: update anoncreds library to support 16KB page size on Android
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

- 1044c9d: make credential_preview optional on V2CredentialOfferMessage
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

### Bug Fixes

- **anoncreds:** migration script credential id ([#1849](https://github.com/openwallet-foundation/credo-ts/issues/1849)) ([e58ec5b](https://github.com/openwallet-foundation/credo-ts/commit/e58ec5bd97043d57fcc3c5a4aee926943e6c5326))

## [0.5.2](https://github.com/openwallet-foundation/credo-ts/compare/v0.5.1...v0.5.2) (2024-04-26)

### Bug Fixes

- **anoncreds:** credential exchange record migration ([#1844](https://github.com/openwallet-foundation/credo-ts/issues/1844)) ([93b3986](https://github.com/openwallet-foundation/credo-ts/commit/93b3986348a86365c3a2faf8023a51390528df93))
- **anoncreds:** unqualified revocation registry processing ([#1833](https://github.com/openwallet-foundation/credo-ts/issues/1833)) ([edc5735](https://github.com/openwallet-foundation/credo-ts/commit/edc5735ccb663acabe8b8480f36cc3a72a1cf63d))
- node-ffi-napi compatibility ([#1821](https://github.com/openwallet-foundation/credo-ts/issues/1821)) ([81d351b](https://github.com/openwallet-foundation/credo-ts/commit/81d351bc9d4d508ebfac9e7f2b2f10276ab1404a))

### Features

- sort requested credentials ([#1839](https://github.com/openwallet-foundation/credo-ts/issues/1839)) ([b46c7fa](https://github.com/openwallet-foundation/credo-ts/commit/b46c7fa459d7e1a81744353bf595c754fad1b3a1))

## [0.5.1](https://github.com/openwallet-foundation/credo-ts/compare/v0.5.0...v0.5.1) (2024-03-28)

### Bug Fixes

- anoncreds w3c migration metadata ([#1803](https://github.com/openwallet-foundation/credo-ts/issues/1803)) ([069c9c4](https://github.com/openwallet-foundation/credo-ts/commit/069c9c4fe362ee6c8af233df154d2d9b2c0f2d44))

### Features

- **anoncreds:** expose methods and metadata ([#1797](https://github.com/openwallet-foundation/credo-ts/issues/1797)) ([5992c57](https://github.com/openwallet-foundation/credo-ts/commit/5992c57a34d3b48dfa86cb659c77af498b6e8708))

# [0.5.0](https://github.com/openwallet-foundation/credo-ts/compare/v0.4.2...v0.5.0) (2024-03-13)

### Bug Fixes

- abandon proof protocol if presentation fails ([#1610](https://github.com/openwallet-foundation/credo-ts/issues/1610)) ([b2ba7c7](https://github.com/openwallet-foundation/credo-ts/commit/b2ba7c7197139e780cbb95eed77dc0a2ad3b3210))
- **anoncreds:** allow for zero idx to be used for revocation ([#1742](https://github.com/openwallet-foundation/credo-ts/issues/1742)) ([a1b9901](https://github.com/openwallet-foundation/credo-ts/commit/a1b9901b8bb232560118c902d86464e28d8a73fa))
- **anoncreds:** only store the revocation registry definition when the state is finished ([#1735](https://github.com/openwallet-foundation/credo-ts/issues/1735)) ([f7785c5](https://github.com/openwallet-foundation/credo-ts/commit/f7785c52b814dfa01c6d16dbecfcc937d533b710))
- **anoncreds:** pass along options for registry and status list ([#1734](https://github.com/openwallet-foundation/credo-ts/issues/1734)) ([e4b99a8](https://github.com/openwallet-foundation/credo-ts/commit/e4b99a86c76a1a4a41aebb94da0b57f774dd6aaf))
- **core:** query credential and proof records by correct DIDComm role ([#1780](https://github.com/openwallet-foundation/credo-ts/issues/1780)) ([add7e09](https://github.com/openwallet-foundation/credo-ts/commit/add7e091e845fdaddaf604335f19557f47a31079))
- presentation submission format ([#1792](https://github.com/openwallet-foundation/credo-ts/issues/1792)) ([1a46e9f](https://github.com/openwallet-foundation/credo-ts/commit/1a46e9f02599ed8b2bf36f5b9d3951d143852f03))
- query the record by credential and proof role ([#1784](https://github.com/openwallet-foundation/credo-ts/issues/1784)) ([d2b5cd9](https://github.com/openwallet-foundation/credo-ts/commit/d2b5cd9cbbfa95cbdcde9a4fed3305bab6161faf))
- save AnonCredsCredentialRecord createdAt ([#1603](https://github.com/openwallet-foundation/credo-ts/issues/1603)) ([a1942f8](https://github.com/openwallet-foundation/credo-ts/commit/a1942f8a8dffb11558dcbb900cbeb052e7d0227e))
- w3c anoncreds ([#1791](https://github.com/openwallet-foundation/credo-ts/issues/1791)) ([913596c](https://github.com/openwallet-foundation/credo-ts/commit/913596c4e843855f77a490428c55daac220bc8c6))

### Features

- anoncreds w3c migration ([#1744](https://github.com/openwallet-foundation/credo-ts/issues/1744)) ([d7c2bbb](https://github.com/openwallet-foundation/credo-ts/commit/d7c2bbb4fde57cdacbbf1ed40c6bd1423f7ab015))
- **anoncreds:** issue revocable credentials ([#1427](https://github.com/openwallet-foundation/credo-ts/issues/1427)) ([c59ad59](https://github.com/openwallet-foundation/credo-ts/commit/c59ad59fbe63b6d3760d19030e0f95fb2ea8488a))
- **indy-vdr:** register revocation registry definitions and status list ([#1693](https://github.com/openwallet-foundation/credo-ts/issues/1693)) ([ee34fe7](https://github.com/openwallet-foundation/credo-ts/commit/ee34fe71780a0787db96e28575eeedce3b4704bd))
- **openid4vc:** persistance and events ([#1793](https://github.com/openwallet-foundation/credo-ts/issues/1793)) ([f4c386a](https://github.com/openwallet-foundation/credo-ts/commit/f4c386a6ccf8adb829cad30b81d524e6ffddb029))
- optional backup on storage migration ([#1745](https://github.com/openwallet-foundation/credo-ts/issues/1745)) ([81ff63c](https://github.com/openwallet-foundation/credo-ts/commit/81ff63ccf7c71eccf342899d298a780d66045534))
- sped up lookup for revocation registries ([#1605](https://github.com/openwallet-foundation/credo-ts/issues/1605)) ([32ef8c5](https://github.com/openwallet-foundation/credo-ts/commit/32ef8c5a002c2cfe209c72e01f95b43337922fc6))

## [0.4.2](https://github.com/hyperledger/aries-framework-javascript/compare/v0.4.1...v0.4.2) (2023-10-05)

### Bug Fixes

- **oob:** support oob with connection and messages ([#1558](https://github.com/hyperledger/aries-framework-javascript/issues/1558)) ([9732ce4](https://github.com/hyperledger/aries-framework-javascript/commit/9732ce436a0ddee8760b02ac5182e216a75176c2))

## [0.4.1](https://github.com/hyperledger/aries-framework-javascript/compare/v0.4.0...v0.4.1) (2023-08-28)

### Bug Fixes

- **anoncreds:** wrong key name for predicates in proof object ([#1517](https://github.com/hyperledger/aries-framework-javascript/issues/1517)) ([d895c78](https://github.com/hyperledger/aries-framework-javascript/commit/d895c78e0e02954a95ad1fd7e2251ee9a02445dc))

### Features

- **anoncreds:** auto create link secret ([#1521](https://github.com/hyperledger/aries-framework-javascript/issues/1521)) ([c6f03e4](https://github.com/hyperledger/aries-framework-javascript/commit/c6f03e49d79a33b1c4b459cef11add93dee051d0))
- oob without handhsake improvements and routing ([#1511](https://github.com/hyperledger/aries-framework-javascript/issues/1511)) ([9e69cf4](https://github.com/hyperledger/aries-framework-javascript/commit/9e69cf441a75bf7a3c5556cf59e730ee3fce8c28))

# [0.4.0](https://github.com/hyperledger/aries-framework-javascript/compare/v0.3.3...v0.4.0) (2023-06-03)

### Bug Fixes

- add reflect-metadata ([#1409](https://github.com/hyperledger/aries-framework-javascript/issues/1409)) ([692defa](https://github.com/hyperledger/aries-framework-javascript/commit/692defa45ffcb4f36b0fa36970c4dc27aa75317c))
- **anoncreds:** Buffer not imported from core ([#1367](https://github.com/hyperledger/aries-framework-javascript/issues/1367)) ([c133538](https://github.com/hyperledger/aries-framework-javascript/commit/c133538356471a6a0887322a3f6245aa5193e7e4))
- **anoncreds:** include prover_did for legacy indy ([#1342](https://github.com/hyperledger/aries-framework-javascript/issues/1342)) ([d38ecb1](https://github.com/hyperledger/aries-framework-javascript/commit/d38ecb14cb58f1eb78e01c91699bb990d805dc08))
- **anoncreds:** make revocation status list inline with the spec ([#1421](https://github.com/hyperledger/aries-framework-javascript/issues/1421)) ([644e860](https://github.com/hyperledger/aries-framework-javascript/commit/644e860a05f40166e26c497a2e8619c9a38df11d))
- **askar:** anoncrypt messages unpacking ([#1332](https://github.com/hyperledger/aries-framework-javascript/issues/1332)) ([1c6aeae](https://github.com/hyperledger/aries-framework-javascript/commit/1c6aeae31ac57e83f4059f3dba35ccb1ca36926e))
- incorrect type for anoncreds registration ([#1396](https://github.com/hyperledger/aries-framework-javascript/issues/1396)) ([9f0f8f2](https://github.com/hyperledger/aries-framework-javascript/commit/9f0f8f21e7436c0a422d8c3a42a4cb601bcf7c77))
- issuance with unqualified identifiers ([#1431](https://github.com/hyperledger/aries-framework-javascript/issues/1431)) ([de90caf](https://github.com/hyperledger/aries-framework-javascript/commit/de90cafb8d12b7a940f881184cd745c4b5043cbc))
- migration of link secret ([#1444](https://github.com/hyperledger/aries-framework-javascript/issues/1444)) ([9a43afe](https://github.com/hyperledger/aries-framework-javascript/commit/9a43afec7ea72a6fa8c6133f0fad05d8a3d2a595))
- various anoncreds revocation fixes ([#1416](https://github.com/hyperledger/aries-framework-javascript/issues/1416)) ([d9cfc7d](https://github.com/hyperledger/aries-framework-javascript/commit/d9cfc7df6679d2008d66070a6c8a818440d066ab))

- feat!: add data, cache and temp dirs to FileSystem (#1306) ([ff5596d](https://github.com/hyperledger/aries-framework-javascript/commit/ff5596d0631e93746494c017797d0191b6bdb0b1)), closes [#1306](https://github.com/hyperledger/aries-framework-javascript/issues/1306)

### Features

- 0.4.0 migration script ([#1392](https://github.com/hyperledger/aries-framework-javascript/issues/1392)) ([bc5455f](https://github.com/hyperledger/aries-framework-javascript/commit/bc5455f7b42612a2b85e504bc6ddd36283a42bfa))
- add anoncreds-rs package ([#1275](https://github.com/hyperledger/aries-framework-javascript/issues/1275)) ([efe0271](https://github.com/hyperledger/aries-framework-javascript/commit/efe0271198f21f1307df0f934c380f7a5c720b06))
- **anoncreds:** add anoncreds API ([#1232](https://github.com/hyperledger/aries-framework-javascript/issues/1232)) ([3a4c5ec](https://github.com/hyperledger/aries-framework-javascript/commit/3a4c5ecd940e49d4d192eef1d41f2aaedb34d85a))
- **anoncreds:** add AnonCreds format services ([#1385](https://github.com/hyperledger/aries-framework-javascript/issues/1385)) ([5f71dc2](https://github.com/hyperledger/aries-framework-javascript/commit/5f71dc2b403f6cb0fc9bb13f35051d377c2d1250))
- **anoncreds:** add getCredential(s) methods ([#1386](https://github.com/hyperledger/aries-framework-javascript/issues/1386)) ([2efc009](https://github.com/hyperledger/aries-framework-javascript/commit/2efc0097138585391940fbb2eb504e50df57ec87))
- **anoncreds:** add legacy indy credential format ([#1220](https://github.com/hyperledger/aries-framework-javascript/issues/1220)) ([13f3740](https://github.com/hyperledger/aries-framework-javascript/commit/13f374079262168f90ec7de7c3393beb9651295c))
- **anoncreds:** legacy indy proof format service ([#1283](https://github.com/hyperledger/aries-framework-javascript/issues/1283)) ([c72fd74](https://github.com/hyperledger/aries-framework-javascript/commit/c72fd7416f2c1bc0497a84036e16adfa80585e49))
- **anoncreds:** store method name in records ([#1387](https://github.com/hyperledger/aries-framework-javascript/issues/1387)) ([47636b4](https://github.com/hyperledger/aries-framework-javascript/commit/47636b4a08ffbfa9a3f2a5a3c5aebda44f7d16c8))
- **anoncreds:** support credential attribute value and marker ([#1369](https://github.com/hyperledger/aries-framework-javascript/issues/1369)) ([5559996](https://github.com/hyperledger/aries-framework-javascript/commit/555999686a831e6988564fd5c9c937fc1023f567))
- **anoncreds:** use legacy prover did ([#1374](https://github.com/hyperledger/aries-framework-javascript/issues/1374)) ([c17013c](https://github.com/hyperledger/aries-framework-javascript/commit/c17013c808a278d624210ce9e4333860cd78fc19))
- default return route ([#1327](https://github.com/hyperledger/aries-framework-javascript/issues/1327)) ([dbfebb4](https://github.com/hyperledger/aries-framework-javascript/commit/dbfebb4720da731dbe11efdccdd061d1da3d1323))
- **indy-vdr:** schema + credential definition endorsement ([#1451](https://github.com/hyperledger/aries-framework-javascript/issues/1451)) ([25b981b](https://github.com/hyperledger/aries-framework-javascript/commit/25b981b6e23d02409e90dabdccdccc8904d4e357))
- outbound message send via session ([#1335](https://github.com/hyperledger/aries-framework-javascript/issues/1335)) ([582c711](https://github.com/hyperledger/aries-framework-javascript/commit/582c711728db12b7d38a0be2e9fa78dbf31b34c6))

### BREAKING CHANGES

- Agent-produced files will now be divided in different system paths depending on their nature: data, temp and cache. Previously, they were located at a single location, defaulting to a temporary directory.

If you specified a custom path in `FileSystem` object constructor, you now must provide an object containing `baseDataPath`, `baseTempPath` and `baseCachePath`. They can point to the same path, although it's recommended to specify different path to avoid future file clashes.
