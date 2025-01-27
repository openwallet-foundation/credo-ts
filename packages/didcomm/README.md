<p align="center">
  <br />
  <img
    alt="Credo Logo"
    src="https://github.com/openwallet-foundation/credo-ts/blob/c7886cb8377ceb8ee4efe8d264211e561a75072d/images/credo-logo.png"
    height="250px"
  />
</p>
<h1 align="center"><b>Credo DIDComm Module</b></h1>
<p align="center">
  <a
    href="https://raw.githubusercontent.com/openwallet-foundation/credo-ts/main/LICENSE"
    ><img
      alt="License"
      src="https://img.shields.io/badge/License-Apache%202.0-blue.svg"
  /></a>
  <a href="https://www.typescriptlang.org/"
    ><img
      alt="typescript"
      src="https://img.shields.io/badge/%3C%2F%3E-TypeScript-%230074c1.svg"
  /></a>
    <a href="https://www.npmjs.com/package/@credo-ts/action-menu"
    ><img
      alt="@credo-ts/action-menu version"
      src="https://img.shields.io/npm/v/@credo-ts/action-menu"
  /></a>

</p>
<br />

Base DIDComm package for [Credo](https://github.com/openwallet-foundation/credo-ts.git). Adds all [DIDComm v1](https://hyperledger.github.io/aries-rfcs/latest/concepts/0005-didcomm/) Core protocols, such as Connections, Out-of-Band, Discover Features, Mediation Coordination, Message Pickup, Proofs and Credentials as defined in [Aries RFCs](https://github.com/hyperledger/aries-rfcs/tree/main/features).

### Quick start

In order for this module to work, we have to inject it into the agent to access agent functionality. See the example for more information.

> **Note**: At the moment, for a basic DIDComm agent to work, it is required to instantiate at least 3 modules besides the basic `DidCommModule`: `OutOfBandModule`, `ConnectionsModule` and `MessagePickupModule`

### Example of usage

```ts
import type { DidCommModuleConfigOptions } from '@credo-ts/didcomm'

import { agentDependencies, HttpInboundTransport } from '@credo-ts/node'
import {
  ConnectionsModule,
  ProofsModule,
  CredentialsModule,
  HttpOutboundTransport,
  getDefaultDidcommModules,
} from '@credo-ts/didcomm'

const agent = new Agent({
  config: {
    /* config */
  },
  dependencies: agentDependencies,
  modules: {
    ...getDefaultDidcommModules(didcommConfig),
    connections: new ConnectionsModule({
      /* Custom module settings */
    }),
    credentials: new CredentialsModule({
      /* Custom module settings */
    }),
    proofs: new ProofsModule({
      /* Custom module settings */
    }),
    /* */
    /* other custom modules */
  },
})

// Register inbound and outbound transports for DIDComm
agent.modules.didcomm.registerInboundTransport(new HttpInboundTransport({ port }))
agent.modules.didcomm.registerOutboundTransport(new HttpOutboundTransport())

await agent.initialize()

// Create an invitation
const outOfBand = await this.agent.modules.oob.createInvitation()
```

In this example, by using the convenient method `getDefaultDidcommModules` you can easily instantiate the basic DIDComm protocols: out-of-band, connections, message pickup, discover features, proof exchange, issue credentials, basic message and mediation coordination. You can of course instantiate only the ones you need for your particular implementation.
