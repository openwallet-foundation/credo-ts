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

### Example of usage

```ts
import { Agent } from "@credo-ts/core";
import {
  DidCommModule,
  DidCommHttpInboundTransport,
  DidCommHttpOutboundTransport,
  DidCommWsInboundTransport,
  DidCommWsOutboundTransport,
} from "@credo-ts/didcomm";
import { agentDependencies, webSocketHost } from "@credo-ts/node";
import { expressHost } from "@credo-ts/node/express";

const agent = new Agent({
  config: {
    /* config */
  },
  dependencies: agentDependencies,
  modules: {
    didcomm: new DidCommModule({
      /* didcomm config */

      // Addresses advertised to other agents for sending messages to this agent
      endpoints: ["http://localhost:3000", "ws://localhost:3001"],

      // Inbound and outbound transports are explicit instances in the same configuration.
      transports: {
        inbound: [
          new DidCommHttpInboundTransport({ host: expressHost({ port: 3000 }) }),
          new DidCommWsInboundTransport({ host: webSocketHost({ port: 3001 }) }),
        ],
        outbound: [
          new DidCommHttpOutboundTransport(),
          new DidCommWsOutboundTransport(),
        ],
      },

      connections: {
        /* Custom module settings */
      },
      proofs: {
        /* Custom module settings */
      },
      credentials: {
        /* Custom module settings */
      },

      // can also provide module config for:
      // mediator: {},
      // mediationRecipient: {},
      // messagePickup: {},
      // discovery: {},
      // basicMessages: {},
    }),

    /* other custom modules */
  },
});

await agent.initialize();

// Create an invitation
const outOfBand = await agent.didcomm.oob.createInvitation();
```

### Inbound HTTP and WebSocket transports

Create inbound transport instances and add them to `transports.inbound`, just like outbound transports in `transports.outbound`. In Node, serve HTTP with `expressHost` from `@credo-ts/node/express` and WebSocket with `webSocketHost` from `@credo-ts/node`. Custom transports use the same arrays. The endpoint URLs are the externally reachable addresses advertised to other agents; they can differ from local ports when running behind a proxy.

#### Credo-owned listeners

When a host is given a `port`, it creates and starts the listener when the agent is initialized, and closes it when the agent shuts down:

```ts
const didcomm = new DidCommModule({
  endpoints: ["http://localhost:3000", "ws://localhost:3001"],
  transports: {
    inbound: [
      new DidCommHttpInboundTransport({ host: expressHost({ port: 3000 }) }),
      new DidCommWsInboundTransport({ host: webSocketHost({ port: 3001 }) }),
    ],
  },
});
```

HTTP messages are accepted on `/` by default; pass `path: "/didcomm"` to `DidCommHttpInboundTransport` to use another path.

#### Application-owned Express app

Pass an existing Express app to `expressHost` to add the DIDComm route to it. The application remains responsible for starting and closing its listener:

```ts
import express from "express";

const app = express();
app.get("/health", (_request, response) => response.sendStatus(204));

const didcomm = new DidCommModule({
  endpoints: ["https://agent.example"],
  transports: {
    inbound: [new DidCommHttpInboundTransport({ host: expressHost({ app }) })],
  },
});

const agent = new Agent({ /* ... */ modules: { didcomm } });
await agent.initialize();
const server = app.listen(3000);
```

#### Sharing one port between HTTP and WebSocket

To accept WebSocket connections on the HTTP listener, pass a `WebSocketServer` created with `noServer: true` to `webSocketHost` and forward upgrade requests to it:

```ts
import express from "express";
import { WebSocketServer } from "ws";

const app = express();
const socketServer = new WebSocketServer({ noServer: true });
const httpHost = expressHost({ app, port: 3000 });

const didcomm = new DidCommModule({
  endpoints: ["http://localhost:3000", "ws://localhost:3000"],
  transports: {
    inbound: [
      new DidCommHttpInboundTransport({ host: httpHost }),
      new DidCommWsInboundTransport({ host: webSocketHost({ server: socketServer }) }),
    ],
  },
});

const agent = new Agent({ /* ... */ modules: { didcomm } });
await agent.initialize();

httpHost.server?.on("upgrade", (request, socket, head) => {
  socketServer.handleUpgrade(request, socket, head, (webSocket) => {
    socketServer.emit("connection", webSocket, request);
  });
});
```

`webSocketHost` closes the provided `WebSocketServer` when the agent shuts down.

#### Registering transports on the agent

As an alternative to module configuration, transports can be created directly and registered on the agent. The inbound transport classes are exported by `@credo-ts/didcomm` and take a host. Transports must be registered before `agent.initialize()`; transports registered afterwards are not started.

```ts
import {
  DidCommHttpInboundTransport,
  DidCommHttpOutboundTransport,
  DidCommWsInboundTransport,
  DidCommWsOutboundTransport,
} from "@credo-ts/didcomm";
import { webSocketHost } from "@credo-ts/node";
import { expressHost } from "@credo-ts/node/express";

// Inbound: receive messages over HTTP and WebSocket
agent.didcomm.registerInboundTransport(
  new DidCommHttpInboundTransport({ host: expressHost({ port: 3000 }) })
);
agent.didcomm.registerInboundTransport(
  new DidCommWsInboundTransport({ host: webSocketHost({ port: 3001 }) })
);

// Outbound: send messages to other agents over HTTP and WebSocket
agent.didcomm.registerOutboundTransport(new DidCommHttpOutboundTransport());
agent.didcomm.registerOutboundTransport(new DidCommWsOutboundTransport());

await agent.initialize();
```

The same transport instances can also be passed to `transports.inbound` and `transports.outbound` in the module configuration. The `DidCommHttpInboundTransport` and `DidCommWsInboundTransport` classes exported by `@credo-ts/node` continue to work unchanged, but are deprecated in favour of the transport classes exported by `@credo-ts/didcomm`.

#### Other or custom inbound transports

Any class implementing `DidCommInboundTransport` can receive messages, for example a transport for another protocol or an existing transport configured differently. Add it to `transports.inbound` alongside the built-in inbound transports:

```ts
import type { AgentContext } from "@credo-ts/core";
import type { DidCommInboundTransport } from "@credo-ts/didcomm";

class MyInboundTransport implements DidCommInboundTransport {
  public async start(agentContext: AgentContext) {
    /* start accepting messages and emit them as DidCommMessageReceived events */
  }

  public async stop() {
    /* stop accepting messages */
  }
}

const didcomm = new DidCommModule({
  endpoints: ["http://localhost:3000"],
  transports: {
    inbound: [
      new DidCommHttpInboundTransport({ host: expressHost({ port: 3000 }) }),
      new MyInboundTransport(),
    ],
  },
});
```

All configured inbound and outbound transports are started when the agent is initialized and stopped when it shuts down.
