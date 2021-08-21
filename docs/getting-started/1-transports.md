# Transports

An agent needs an inbound and outbound transport. At this current time, the outbound transport is already built-in and can be used. The inbound transport is a tad bit more complicated and has to be added manually.

- [Aries RFC 0025: DIComm Transports](https://github.com/hyperledger/aries-rfcs/blob/master/features/0025-didcomm-transports/README.md)
- [Aries RFC 0005: DID Communication](https://github.com/hyperledger/aries-rfcs/blob/master/concepts/0005-didcomm/README.md)

## Outbound Transport

Outbound transports allow you to send messages to other agents. Currently, only a single outbound transport can be used. See [Issue 268: Add support for multiple transports](https://github.com/hyperledger/aries-framework-javascript/issues/268) for progress on supporting multiple outbound transports.

```ts
import { HttpOutboundTransport, WsOutboundTransport, Agent } from '@aries-framework/core'

const agent = new Agent({
  /* config */
})

// Use HTTP as outbound transport
const httpOutboundTransport = new HttpOutboundTransport()
agent.registerOutboundTransport(httpOutboundTransport)

// Or use WebSocket instead
const wsOutboundTransport = new WsOutboundTransport()
agent.registerOutboundTransport(wsOutboundTransport)
```

## Inbound Transport

> TODO:
