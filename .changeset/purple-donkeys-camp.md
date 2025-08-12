---
'@credo-ts/question-answer': minor
'@credo-ts/action-menu': minor
'@credo-ts/anoncreds': minor
'@credo-ts/indy-vdr': minor
'@credo-ts/didcomm': minor
'@credo-ts/tenants': minor
'@credo-ts/askar': minor
'@credo-ts/cheqd': minor
'@credo-ts/core': minor
'@credo-ts/drpc': minor
'@credo-ts/node': minor
---

DIDComm has been extracted out of the Core. This means that now all DIDComm related modules (e.g. proofs, credentials) must be explicitly added when creating an `Agent` instance. Therefore, their API will be accesable under `agent.modules.[moduleAPI]` instead of `agent.[moduleAPI]`. Some `Agent` DIDComm-related properties and methods where also moved to the API of a new DIDComm module (e.g. `agent.registerInboundTransport` turned into `agent.modules.didcomm.registerInboundTransport`).

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
    this.agent.registerInboundTransport(new HttpInboundDidCommTransport({ port }))
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
    agent.modules.didcomm.registerInboundTransport(new HttpInboundDidCommTransport({ port }))
    agent.modules.didcomm.registerOutboundTransport(new HttpDidCommOutboundTransport())
```
