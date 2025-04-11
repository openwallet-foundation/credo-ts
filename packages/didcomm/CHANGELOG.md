# @credo-ts/didcomm

## 0.6.0

### Minor Changes

- 0d877f5: Now using did:peer:4 by default when creating DID Exchange Requests as response to an Out of Band invitation.

  It is possible to return to previous behaviour by manually setting `peerNumAlgoForDidExchangeRequests` option in DIDComm Connections module config.

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

### Patch Changes

- Updated dependencies [2d10ec3]
- Updated dependencies [6d83136]
- Updated dependencies [312a7b2]
- Updated dependencies [297d209]
- Updated dependencies [11827cc]
- Updated dependencies [9f78a6e]
- Updated dependencies [297d209]
- Updated dependencies [bea846b]
- Updated dependencies [13cd8cb]
- Updated dependencies [15acc49]
- Updated dependencies [90caf61]
- Updated dependencies [dca4fdf]
- Updated dependencies [14673b1]
- Updated dependencies [607659a]
- Updated dependencies [44b1866]
- Updated dependencies [5f08bc6]
- Updated dependencies [27f971d]
- Updated dependencies [2d10ec3]
- Updated dependencies [1a4182e]
- Updated dependencies [90caf61]
- Updated dependencies [9f78a6e]
- Updated dependencies [8baa7d7]
- Updated dependencies [decbcac]
- Updated dependencies [9df09fa]
- Updated dependencies [70c849d]
- Updated dependencies [897c834]
- Updated dependencies [a53fc54]
- Updated dependencies [edd2edc]
- Updated dependencies [9f78a6e]
- Updated dependencies [e80794b]
- Updated dependencies [9f78a6e]
- Updated dependencies [9f78a6e]
- Updated dependencies [8baa7d7]
- Updated dependencies [decbcac]
- Updated dependencies [27f971d]
  - @credo-ts/core@0.6.0
