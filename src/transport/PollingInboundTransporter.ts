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
