# @credo-ts/didcomm

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

- 251cbe5: fix: allow sending Problem Report when a DIDComm proofs flow is in proposal-sent state
- Updated dependencies [9f60e1b]
  - @credo-ts/core@0.6.1

## 0.6.0

### Minor Changes

- 879ed2c: deprecate node 18
- 2cace9c: refactor: remove support for DIDComm linked attachments. The functionality was not working correctly anymore, and only supported for the deprecated v1 issuance protocol
- b5fc7a6: - All `didcomm` package modules, APIs, models and services that are used for dependency injection now are prefixed with `DidComm` in its naming
  - DIDComm-related events have also changed their text string to make it possible to distinguish them from events triggered by other protocols
  - DIDComm credentials module API has been updated to use the term `credentialExchangeRecord` instead of `credentialRecord`, since it is usually confused with W3cCredentialRecords (and potentially other kind of credential records we might have). I took this opportunity to also update `declineOffer` options structure to match DIDComm proofs module API
  - DIDComm-related records were renamed, but their type is still the original one (e.g. `CredentialRecord`, `BasicMessageRecord`). Probably it's worth to take this major release to do the migration, but I'm afraid that it will be a bit risky, so I'm hesitating to do so or leaving it for some other major upgrade (if we think it's actually needed)
- e936068: when signing in Credo, it is now required to always reference a key id. For DIDs this is extracted from the DidRecord, and for JWKs (e.g. in holder binding) this is extracted form the `kid` of the JWK. For X509 certificates you need to make sure there is a key id attached to the certificate manually for now, since we don't have a X509 record like we have a DidRecord. For x509 certificates created before 0.6 you can use the legacy key id (`certificate.keyId = certificate.publicJwk.legacyKeyId`), for certificates created after 0.6 you need to manually store the key id and set it on the certificate after decoding.

  For this reason, we now require instances of X509 certificates where we used to require encoded certificates, to allow you to set the keyId on the certificate beforehand.

- 2cace9c: The following modules are marked as deprecated and will be removed in version 0.7 of Credo:
  - DIDComm Connection Protocol V1 - Update to the DID Exchange protocol instead.
  - DIDComm V1 Credential Protocol - Update to the DIDComm V2 Credential Protocol instead.
  - DIDComm Legacy Indy Credential Format - Update to the DIDComm AnonCreds Credential Format.
  - DIDComm V1 Proof Protocol - Update to the DIDComm V2 Proof Protocol instead.
  - DIDComm Legacy Indy Proof Format - Update to the DIDComm AnonCreds Proof Format.
- 0d877f5: Now using did:peer:4 by default when creating DID Exchange Requests as response to an Out of Band invitation.

  It is possible to return to previous behaviour by manually setting `peerNumAlgoForDidExchangeRequests` option in DIDComm Connections module config.

- e936068: The `Key` and `Jwk` classes have been removed in favour of a new `PublicJwk` class, and all APIs in Credo have been updated to use the new `PublicJwk` class. Leveraging Jwk as the base for all APIs provides more flexility and makes it easier to support key types where it's not always so easy to extract the raw public key bytes. In addition all the previous Jwk relatedfunctionality has been replaced with the new KMS jwk functionalty. For example `JwaSignatureAlgorithm` is now `Kms.KnownJwaSignatureAlgorithms`.
- e936068: The wallet API has been completely rewritten to be more generic, support multiple backends at the same time, support generic encrypting and decryption, support symmetric keys, and enable backends that use key ids rather than the public key to identify a key. This has resulted in significant breaking changes, and all usages of the wallet api should be updated to use the new `agent.kms` APIs. In addition the wallet is not available anymore on the agentContext. If you used this, instead inject the KMS API using `agentContext.resolve(Kms.KeyManagementApi)`.
- 9df09fa: - messagehandler should return undefined if it doesn't want to response with a message
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

- 9ef54ba: `MessagePickupRepository` has been refactored to `QueueTransportRepository`, and now belongs to DIDComm module configuration. As a result, MessagePickupRepository injection symbol has been dropped. If you want to retrieve current QueueTransportRepository instance, resolve DidCommModuleConfig and get `queueTransportRepository`.

  All methods in QueueTransportRepository now include `AgentContext` as their first argument.

- bc6f0c7: Add support for ESM module syntax.

  - Use `tsdown` to bundle for ESM -> tsdown is based on rust, so it should help with performance
  - Update to `vitest` since jest doesn't work well with ESM -> this should also help with performance
  - Simplify type checking -> just a single type check script instead of one for all packages. This should help with performance.

  NOTE: Since React Native bundles your code, the update to ESM should not cause issues. In addition all latest minor releases of Node 20 and 22 now support requiring ESM modules. This means that even if you project is still a CommonJS project, it can now depend on ESM modules. For this reason Credo is now fully an ESM module.

  Initially we added support for both CJS and ESM in parallel. However this caused issues with some libraries requiring the CJS output, and other the ESM output. Since Credo is only meant to be installed a single time for the dependency injection to work correctly, this resulted in unexpected behavior.

- d9e04db: Update to Express JS v5. If you're using the DIDComm Http transports, or the OpenID4VC issuer and verifier packages you should update to Express v5

### Patch Changes

- 1810764: fix: incorrect key alg for didcomm. With the introduction of the new KMS API, the XC20P algorithm was used instead of the C20P. This is not resolved and tests have been added to ensure interop with previous Credo versions.
- 652ade8: feat(didcomm): emit event on hangup
- 617b523: - Added a new package to use `redis` for caching in Node.js
  - Add a new option `allowCache` to a record, which allows to CRUD the cache before calling the storage service
    - This is only set to `true` on the `connectionRecord` and mediation records for now, improving the performance of the mediation flow
- 09ea6e3: fix: correctly find did record for recieved message if didcomm service uses X25519 key as recipientKey
- a4f443b: fix: allow did URLs in thread ids
- 5ff7bba: feat(didcomm): allow sending revocation notifications without the need of keeping the related Credential Exchange record
- 11545ce: - Made the receivedAt property of a queued DIDComm message required
- d06669c: feat: support DIDComm Out of Band proof proposals
- 676af7f: feat: allow setting DIDComm transports on Agent constructor by setting `transports` in DIDComm module configuration
- d6086e9: Export a few utils used by dependents.
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
