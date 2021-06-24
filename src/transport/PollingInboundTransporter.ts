import type { Agent } from '../agent/Agent'
import type { InboundTransporter } from './InboundTransporter'

export class PollingInboundTransporter implements InboundTransporter {
  public stop: boolean
  private pollingInterval: number

  public constructor(pollingInterval = 5000) {
    this.stop = false
    this.pollingInterval = pollingInterval
  }

  public async start(agent: Agent) {
    await this.pollDownloadMessages(agent)
  }

  private async pollDownloadMessages(agent: Agent) {
    setInterval(async () => {
      if (!this.stop) {
        const connection = await agent.mediationRecipient.getDefaultMediatorConnection()
        if (connection && connection.state == 'complete') {
          await agent.mediationRecipient.downloadMessages(connection)
        }
      }
    }, this.pollingInterval)
  }
}

export class TrustPingPollingInboundTransporter implements InboundTransporter {
  public run: boolean
  private pollingInterval: number

  public constructor(pollingInterval = 5000) {
    this.run = false
    this.pollingInterval = pollingInterval
  }

  public async start(agent: Agent) {
    this.run = true
    await this.pollDownloadMessages(agent)
  }

  public async stop(): Promise<void> {
    this.run = false
  }

  private async pollDownloadMessages(recipient: Agent) {
    setInterval(async () => {
      if (this.run) {
        const connection = await recipient.mediationRecipient.getDefaultMediatorConnection()
        if (connection && connection.state == 'complete') {
          /*ping mediator uses a trust ping to trigger any stored messages to be sent back, one at a time.*/
          await recipient.connections.pingMediator(connection)
        }
      }
    }, this.pollingInterval)
  }
}