# Transports

An agent needs an inbound and outbound transporter. At this current time, the outbound transporter is already built-in and can be used. The inbound transporter is a tad bit more complicated and has to be added manually.

- [Aries RFC 0025: DIComm Transports](https://github.com/hyperledger/aries-rfcs/blob/master/features/0025-didcomm-transports/README.md)
- [Aries RFC 0005: DID Communication](https://github.com/hyperledger/aries-rfcs/blob/master/concepts/0005-didcomm/README.md)

## Outbound Transport

Outbound transports allow you to send messages to other agents. Currently, only a single outbound transport can be used. See [Issue 268: Add support for multiple transports](https://github.com/hyperledger/aries-framework-javascript/issues/268) for progress on supporting multiple outbound transports.

```ts
import { HttpOutboundTransporter, WsOutboundTransporter Agent } from 'aries-framework'

const agent = new Agent({
  /* config */
})

// Use HTTP as outbound transporter
const httpOutboundTransporter = new HttpOutboundTransporter(agent)
agent.setOutboundTransporter(httpOutboundTransporter)

// Or use WebSocket instead
const wsOutboundTransporter = new WsOutboundTransporter(agent)
agent.setOutboundTransporter(wsOutboundTransporter)
```

## Inbound Transport

Inbound transports allow you to receive messages from other agents. Only `PollingInboundTransporter` is exported from the framework at the moment. Make sure you provide a `mediatorUrl` if using the polling inbound transporters. See the example transports below for other inbound transports.

```ts
import { Agent, PollingInboundTransporter } from 'aries-framework'

const agentConfig = {
  // ... agent config ... //
  mediatorUrl: 'https://your-afj-mediator-url.com',
}

const agent = new Agent(agentConfig)

// Construct polling inbound transporter with optional polling interval in ms
const pollingInboundTransporter = new PollingInboundTransporter(5000)

agent.setInboundTransporter(pollingInboundTransporter)
```

### Example `HttpInboundTransporter`

This is an example of an inbound transport based on [Express JS](https://expressjs.com/). You need to initiate the express server yourself and use that to construct the inbound transport. See []()

```typescript
import { InboundTransporter, Agent, DidCommMimeType } from '../src'
import express, { Express } from 'express'

// Define the Http inbound transport class
export class HttpInboundTransporter implements InboundTransporter {
  private app: Express

  public constructor(app: Express) {
    this.app = app
  }

  public async start(agent: Agent) {
    this.app.post('/msg', async (req, res) => {
      const message = req.body
      const packedMessage = JSON.parse(message)
      const outboundMessage = await agent.receiveMessage(packedMessage)
      if (outboundMessage) {
        res.status(200).json(outboundMessage.payload).end()
      } else {
        res.status(200).end()
      }
    })
  }
}

const agentConfig = {
  // ... other config ... //
  port: 3000,
  host: 'http://localhost',
}

// Create express server
const app = express()

// Set up express server to handle DIDComm mime-types
app.use(
  express.text({
    type: [DidCommMimeType.V0, DidCommMimeType.V1],
  })
)

// Create instance of Http inbound transport
const httpInboundTransport = new HttpInboundTransporter(app)

const agent = new Agent(agentConfig)
agent.setInboundTransporter(httpInboundTransport)

// Listen on port, initialize agent, start inbound transport
app.listen(agentConfig.port, async () => {
  await agent.initialize()
  httpInboundTransport.start(agent)
})
```
