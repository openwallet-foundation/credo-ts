# @credo-ts/didcomm

## 0.6.0

### Minor Changes

- 879ed2c: deprecate node 18
- e936068: when signing in Credo, it is now required to always reference a key id. For DIDs this is extracted from the DidRecord, and for JWKs (e.g. in holder binding) this is extracted form the `kid` of the JWK. For X509 certificates you need to make sure there is a key id attached to the certificate manually for now, since we don't have a X509 record like we have a DidRecord. For x509 certificates created before 0.6 you can use the legacy key id (`certificate.keyId = certificate.publicJwk.legacyKeyId`), for certificates created after 0.6 you need to manually store the key id and set it on the certificate after decoding.

  For this reason, we now require instances of X509 certificates where we used to require encoded certificates, to allow you to set the keyId on the certificate beforehand.

- 0d877f5: Now using did:peer:4 by default when creating DID Exchange Requests as response to an Out of Band invitation.

  It is possible to return to previous behaviour by manually setting `peerNumAlgoForDidExchangeRequests` option in DIDComm Connections module config.

- e936068: The `Key` and `Jwk` classes have been removed in favour of a new `PublicJwk` class, and all APIs in Credo have been updated to use the new `PublicJwk` class. Leveraging Jwk as the base for all APIs provides more flexility and makes it easier to support key types where it's not always so easy to extract the raw public key bytes. In addition all the previous Jwk relatedfunctionality has been replaced with the new KMS jwk functionalty. For example `JwaSignatureAlgorithm` is now `Kms.KnownJwaSignatureAlgorithms`.
- e936068: The wallet API has been completely rewritten to be more generic, support multiple backends at the same time, support generic encrypting and decryption, support symmetric keys, and enable backends that use key ids rather than the public key to identify a key. This has resulted in significant breaking changes, and all usages of the wallet api should be updated to use the new `agent.kms` APIs. In addition the wallet is not available anymore on the agentContext. If you used this, instead inject the KMS API using `agentContext.resolve(Kms.KeyManagementApi)`.
- 9df09fa: - messagehandler should return undefined if it doesn't want to response with a message
- 897c834: DIDComm has been extracted out of the Core. This means that now all DIDComm related modules (e.g. proofs, credentials) must be explicitly added when creating an `Agent` instance. Therefore, their API will be accesable under `agent.modules.[moduleAPI]` instead of `agent.[moduleAPI]`. Some `Agent` DIDComm-related properties and methods where also moved to the API of a new DIDComm module (e.g. `agent.registerInboundTransport` turned into `agent.modules.didcomm.registerInboundTransport`).

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
          connections: new ConnectionsModule({
             autoAcceptConnections: true,
          })
        })
      this.agent.registerInboundTransport(new HttpInboundTransport({ port }))
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
          connections: new ConnectionsModule({
             autoAcceptConnections: true,
          })
        })
      agent.modules.didcomm.registerInboundTransport(new HttpInboundTransport({ port }))
      agent.modules.didcomm.registerOutboundTransport(new HttpOutboundTransport())
  ```

- 9ef54ba: `MessagePickupRepository` has been refactored to `QueueTransportRepository`, and now belongs to DIDComm module configuration. As a result, MessagePickupRepository injection symbol has been dropped. If you want to retrieve current QueueTransportRepository instance, resolve DidCommModuleConfig and get `queueTransportRepository`.

  All methods in QueueTransportRepository now include `AgentContext` as their first argument.

### Patch Changes

- 1810764: fix: incorrect key alg for didcomm. With the introduction of the new KMS API, the XC20P algorithm was used instead of the C20P. This is not resolved and tests have been added to ensure interop with previous Credo versions.
- 617b523: - Added a new package to use `redis` for caching in Node.js
  - Add a new option `allowCache` to a record, which allows to CRUD the cache before calling the storage service
    - This is only set to `true` on the `connectionRecord` and mediation records for now, improving the performance of the mediation flow
- 11545ce: - Made the receivedAt property of a queued DIDComm message required
- Updated dependencies [e936068]
- Updated dependencies [43148b4]
- Updated dependencies [2d10ec3]
- Updated dependencies [6d83136]
- Updated dependencies [312a7b2]
- Updated dependencies [879ed2c]
- Updated dependencies [297d209]
- Updated dependencies [11827cc]
- Updated dependencies [9f78a6e]
- Updated dependencies [297d209]
- Updated dependencies [bea846b]
- Updated dependencies [13cd8cb]
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
- Updated dependencies [607659a]
- Updated dependencies [44b1866]
- Updated dependencies [5f08bc6]
- Updated dependencies [27f971d]
- Updated dependencies [e936068]
- Updated dependencies [2d10ec3]
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
- Updated dependencies [9ef54ba]
- Updated dependencies [e936068]
- Updated dependencies [edd2edc]
- Updated dependencies [9f78a6e]
- Updated dependencies [e936068]
- Updated dependencies [e80794b]
- Updated dependencies [9f78a6e]
- Updated dependencies [9f78a6e]
- Updated dependencies [8baa7d7]
- Updated dependencies [decbcac]
- Updated dependencies [27f971d]
  - @credo-ts/core@0.6.0
