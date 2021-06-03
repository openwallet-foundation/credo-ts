# Transports

An agent needs an inbound and outbound transporter. At this current time, the outbound transporter is already built-in and can be used. The inbound transporter is a tad bit more complicated and has to be added manually.

- [Aries RFC 0025: DIComm Transports](https://github.com/hyperledger/aries-rfcs/blob/master/features/0025-didcomm-transports/README.md)
- [Aries RFC 0005: DID Communication](https://github.com/hyperledger/aries-rfcs/blob/master/concepts/0005-didcomm/README.md)

## Outbound Transport

Outbound transports allow you to send messages to other agents.

```ts
import { HttpOutboundTransporter, Agent } from 'aries-framework'

const agent = new Agent({
  /* config */
})

agent.setOutboundTransporter(HttpOutboundTransporter)
```

## Inbound Transport

### Example `PollingInboundTransporter`

```ts
import { Agent, InboundTransporter } from 'aries-framework'

// In React Native you don't have to import node-fetch
// Fetch is globally available in React Native
import fetch from 'node-fetch'

class PollingInboundTransporter implements InboundTransporter {
  public stop: boolean

  public constructor() {
    this.stop = false
  }
  public async start(agent: Agent) {
    await this.registerMediator(agent)
  }

  public async registerMediator(agent: Agent) {
    const mediatorUrl = agent.getMediatorUrl() || ''
    const mediatorInvitationUrl = await (await fetch(`${mediatorUrl}/invitation`)).text()
    const { verkey: mediatorVerkey } = await (await fetch(`${mediatorUrl}/`)).json()
    await agent.routing.provision({
      verkey: mediatorVerkey,
      invitationUrl: mediatorInvitationUrl,
    })
    this.pollDownloadMessages(agent)
  }

  private pollDownloadMessages(agent: Agent) {
    const loop = async () => {
      while (!this.stop) {
        await agent.routing.downloadMessages()
        await new Promise((res) => setTimeout(res, 5000))
      }
    }
    new Promise(() => {
      loop()
    })
  }
}

export { PollingInboundTransporter }
```
