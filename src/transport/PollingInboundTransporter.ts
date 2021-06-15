import type { Agent } from '../agent/Agent'
import type { InboundTransporter } from './InboundTransporter'

import { AriesFrameworkError } from '../error/AriesFrameworkError'
import { fetch } from '../utils/fetch'
import { sleep } from '../utils/sleep'

export class PollingInboundTransporter implements InboundTransporter {
  public stop: boolean

  public constructor() {
    this.stop = false
  }

  public async start(agent: Agent) {
    await this.registerMediator(agent)
  }

  public async registerMediator(agent: Agent) {
    const mediatorUrl = agent.getMediatorUrl()

    if (!mediatorUrl) {
      throw new AriesFrameworkError(
        'Agent has no mediator URL. Make sure to provide the `mediatorUrl` in the agent config.'
      )
    }

    const invitationResponse = await fetch(`${mediatorUrl}/invitation`)
    const invitationUrl = await invitationResponse.text()

    const mediatorDidResponse = await fetch(`${mediatorUrl}`)
    const { verkey } = await mediatorDidResponse.json()

    await agent.routing.provision({
      verkey,
      invitationUrl,
    })
    this.pollDownloadMessages(agent)
  }

  private async pollDownloadMessages(agent: Agent) {
    while (!this.stop) {
      await agent.routing.downloadMessages()
      await sleep(5000)
    }
  }
}
