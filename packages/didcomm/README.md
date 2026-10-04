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

### Quick start with Node hosts

Register the DIDComm module on the agent and configure transport instances explicitly. This example uses optional Node hosts to manage an Express HTTP listener and a `ws` WebSocket listener. Other runtimes can host the same inbound transports without Express or `ws`, as shown below.

```ts
import { Agent } from "@credo-ts/core";
import {
  DidCommModule,
  DidCommHttpInboundTransport,
  DidCommHttpOutboundTransport,
  DidCommWsInboundTransport,
  DidCommWsOutboundTransport,
} from "@credo-ts/didcomm";
import { agentDependencies } from "@credo-ts/node";
import { httpServerHost } from "@credo-ts/node/http";
import { webSocketHost } from "@credo-ts/node/websocket";

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
          new DidCommHttpInboundTransport({ host: httpServerHost({ port: 3000 }) }),
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

### Hosting DIDComm inbound HTTP and WebSocket

Create inbound transports in `transports.inbound`, alongside any custom inbound transports, and outbound transports in `transports.outbound`. No inbound host is selected automatically. Advertise externally reachable `endpoints`; local listener ports and paths may differ behind a proxy.

Without a host, each `DidCommHttpInboundTransport` exposes a Fetch-compatible `handler`; all configured HTTP handlers are available through `agent.didcomm.httpHandlers`. A handler accepts a `Request` and returns a `Response`, or `undefined` when its path or method does not match. Route nonmatching requests in your application. HTTP contracts and the bounded body reader are exported from `@credo-ts/core/http`.

Likewise, `DidCommWsInboundTransport` exposes an `acceptor`, available as `agent.didcomm.webSocketAcceptor` when exactly one built-in WebSocket inbound transport is configured. A WebSocket server or framework must deliver compatible `WebSocketLike` sockets to `acceptor.accept`. The contracts are exported from `@credo-ts/core/websocket`. Neither core nor DIDComm requires Express or `ws` to host these transports.

#### Hosting HTTP with Hono (no Express host)

For example, Hono can dispatch Fetch requests directly to a hostless HTTP transport. Install `hono` and `@hono/node-server` in your application; they are not dependencies of `@credo-ts/didcomm`. This Node example uses `agentDependencies` for the agent runtime, not for HTTP hosting:

```ts
import { Agent } from "@credo-ts/core";
import { DidCommHttpInboundTransport, DidCommModule } from "@credo-ts/didcomm";
import { agentDependencies } from "@credo-ts/node";
import { serve } from "@hono/node-server";
import { Hono } from "hono";

const didcomm = new DidCommModule({
  endpoints: ["https://agent.example/didcomm"],
  transports: {
    inbound: [new DidCommHttpInboundTransport({ path: "/didcomm" })],
  },
});
const agent = new Agent({
  config: { /* agent config */ },
  dependencies: agentDependencies,
  modules: { didcomm },
});
const [handler] = agent.didcomm.httpHandlers;
if (!handler) throw new Error("No DIDComm HTTP handler configured");

const app = new Hono();
app.post("/didcomm", async (context) =>
  (await handler.handle(context.req.raw)) ?? context.notFound()
);

await agent.initialize();
const server = serve({ fetch: app.fetch, port: 3000 });

// When done, stop the transport before closing the application-owned server.
await agent.shutdown();
await new Promise<void>((resolve, reject) =>
  server.close((error) => (error ? reject(error) : resolve()))
);
```

With no host, agent initialization starts DIDComm message processing but does not open a listener; the application starts and stops its own server. A handler invoked directly before initialization or after shutdown responds with 503 for a matching DIDComm request. For another Fetch-based framework, dispatch its `Request` to the same handler and return the resulting `Response`.

#### Hosting WebSocket connections without a Node host

Configure `new DidCommWsInboundTransport()` without a host if your runtime already accepts WebSocket connections. After constructing the agent with that transport in `transports.inbound`, pass each open socket to its acceptor:

```ts
import type { WebSocketLike } from "@credo-ts/core/websocket";

const acceptor = agent.didcomm.webSocketAcceptor;
if (!acceptor) throw new Error("No DIDComm WebSocket acceptor configured");

function onConnection(socket: WebSocketLike) {
  acceptor.accept(socket);
}

// Register onConnection with your runtime's WebSocket server.
```

The socket must implement `WebSocketLike`; adapt your runtime's socket if necessary. You own the WebSocket server's listener and close it after `agent.shutdown()`. Unlike the Node `webSocketHost`, a manually connected server is responsible for routing only the intended connections to the acceptor.

#### Credo-owned Node HTTP and WebSocket listeners

`httpServerHost` from `@credo-ts/node/http` (backed by an internal Express app) and `webSocketHost` from `@credo-ts/node/websocket` are optional Node hosts. When given a `port`, each starts its own listener on agent initialization and closes it on shutdown:

```ts
const didcomm = new DidCommModule({
  endpoints: ["http://localhost:3000", "ws://localhost:3001"],
  transports: {
    inbound: [
      new DidCommHttpInboundTransport({ host: httpServerHost({ port: 3000 }) }),
      new DidCommWsInboundTransport({ host: webSocketHost({ port: 3001 }) }),
    ],
  },
});
```

HTTP messages are accepted on `/` by default; pass `path: "/didcomm"` to `DidCommHttpInboundTransport` to use another path. Reuse one `httpServerHost` instance for multiple HTTP inbound transports that need to share a listener.

#### Externally owned Express app using the optional Node adapter

If your application already uses Express, pass its app to `expressHost` to adapt Express requests to the neutral handler. The application still starts and closes its own listener; `expressHost` does not own it. You can use a different adapter instead of `expressHost`.

```ts
import express from "express";
import { expressHost } from "@credo-ts/node/express";

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

// When done:
await agent.shutdown();
await new Promise<void>((resolve, reject) =>
  server.close((error) => (error ? reject(error) : resolve()))
);
```

#### Credo-owned HTTP listener with an application-owned WebSocket server

To share the HTTP listener with WebSocket connections, pass a `WebSocketServer` created with `noServer: true` to `webSocketHost` and forward upgrade requests to it. Here Credo owns the HTTP listener, but the application owns the supplied WebSocket server:

```ts
import { WebSocketServer } from "ws";

const socketServer = new WebSocketServer({ noServer: true });
const httpHost = httpServerHost({ port: 3000 });
httpHost.app.get("/health", (_request, response) => response.sendStatus(204));

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
const httpServer = httpHost.server;
if (!httpServer) throw new Error("HTTP host did not start");
httpServer.on("upgrade", (request, socket, head) => {
  socketServer.handleUpgrade(request, socket, head, (webSocket) => {
    socketServer.emit("connection", webSocket, request);
  });
});

// When done:
await agent.shutdown();
await new Promise<void>((resolve, reject) =>
  socketServer.close((error) => (error ? reject(error) : resolve()))
);
```

`webSocketHost` does not close a provided `WebSocketServer`; the application closes it. While the agent is stopped, connections that reach it are closed with code 1013 (try again later), so the agent can be restarted on the same server. A `WebSocketServer` created by `webSocketHost({ port })` is closed on agent shutdown. If you supply your own WebSocket server, you can also attach `agent.didcomm.webSocketAcceptor` to a `webSocketHost({ server })` yourself; detach it before shutting down the agent and closing the server.

#### Registering transports on the agent

As an alternative to module configuration, transports can be created directly and registered on the agent. Built-in inbound transport classes are exported by `@credo-ts/didcomm`; their host is optional. Transports must be registered before `agent.initialize()`; transports registered afterwards are not started automatically.

```ts
import {
  DidCommHttpInboundTransport,
  DidCommHttpOutboundTransport,
  DidCommWsInboundTransport,
  DidCommWsOutboundTransport,
} from "@credo-ts/didcomm";
import { httpServerHost } from "@credo-ts/node/http";
import { webSocketHost } from "@credo-ts/node/websocket";

// Inbound: receive messages over HTTP and WebSocket
agent.didcomm.registerInboundTransport(
  new DidCommHttpInboundTransport({ host: httpServerHost({ port: 3000 }) })
);
agent.didcomm.registerInboundTransport(
  new DidCommWsInboundTransport({ host: webSocketHost({ port: 3001 }) })
);

// Outbound: send messages to other agents over HTTP and WebSocket
agent.didcomm.registerOutboundTransport(new DidCommHttpOutboundTransport());
agent.didcomm.registerOutboundTransport(new DidCommWsOutboundTransport());

await agent.initialize();
```

The same transport instances can also be passed to `transports.inbound` and `transports.outbound` in the module configuration.

#### Other or custom inbound and outbound transports

Custom transports can be added alongside the built-in transports. An inbound transport implements `DidCommInboundTransport` to receive messages; an outbound transport implements `DidCommOutboundTransport` to send messages to endpoints with its `supportedSchemes`. Both implement `start` and `stop` for agent lifecycle management. Add them to `transports.inbound` and `transports.outbound`, respectively:

```ts
import type { AgentContext } from "@credo-ts/core";
import type {
  DidCommInboundTransport,
  DidCommOutboundPackage,
  DidCommOutboundTransport,
} from "@credo-ts/didcomm";

class MyInboundTransport implements DidCommInboundTransport {
  public async start(agentContext: AgentContext) {
    /* start accepting messages and emit them as DidCommMessageReceived events */
  }

  public async stop() {
    /* stop accepting messages */
  }
}

class MyOutboundTransport implements DidCommOutboundTransport {
  public supportedSchemes = ["my-protocol"];

  public async start(agentContext: AgentContext) {
    /* prepare the outbound transport */
  }

  public async sendMessage(outboundPackage: DidCommOutboundPackage) {
    /* send outboundPackage.payload to outboundPackage.endpoint */
  }

  public async stop() {
    /* stop sending messages and release resources */
  }
}

const didcomm = new DidCommModule({
  endpoints: ["http://localhost:3000"],
  transports: {
    inbound: [
      new DidCommHttpInboundTransport({ host: httpServerHost({ port: 3000 }) }),
      new MyInboundTransport(),
    ],
    outbound: [new DidCommHttpOutboundTransport(), new MyOutboundTransport()],
  },
});
```

The custom transport methods above are placeholders; implement message reception and delivery for your protocol before using them.

All configured inbound and outbound transports are started when the agent is initialized and stopped when it shuts down.
