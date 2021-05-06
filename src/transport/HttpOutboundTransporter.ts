import { OutboundTransporter } from './OutboundTransporter'
import { Agent } from '../agent/Agent'
import { Logger } from '../logger'
import { OutboundPackage } from '../types'
import { fetch } from '../utils/fetch'

export class HttpOutboundTransporter implements OutboundTransporter {
  private agent: Agent
  private logger: Logger

  public supportedSchemes = ['http', 'https']

  public constructor(agent: Agent) {
    this.agent = agent
    this.logger = agent.logger
  }

  public async sendMessage(outboundPackage: OutboundPackage) {
    const { payload, endpoint, responseRequested } = outboundPackage

    if (!endpoint) {
      throw new Error(`Missing endpoint. I don't know how and where to send the message.`)
    }

    this.logger.debug(
      `Sending outbound message to connection ${outboundPackage.connection.id}`,
      outboundPackage.payload
    )

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: { 'Content-Type': this.agent.agentConfig.didCommMimeType },
      })
      const responseMessage = await response.text()

      // TODO: do we just want to ignore messages that were
      // returned if we didn't request it?
      if (responseMessage && responseRequested) {
        this.logger.debug(`Response received:\n ${response}`)
        const wireMessage = JSON.parse(responseMessage)
        this.agent.receiveMessage(wireMessage)
      }
    } catch (error) {
      this.logger.error(`Error sending message to ${endpoint}`, {
        error,
        body: payload,
        didCommMimeType: this.agent.agentConfig.didCommMimeType,
      })
    }
  }
}
