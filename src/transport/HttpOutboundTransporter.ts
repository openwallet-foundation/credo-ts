import { OutboundTransporter } from './OutboundTransporter'
import { Agent } from '../agent/Agent'
import { Logger } from '../logger'
import { OutboundPackage } from '../types'
import { fetch } from '../utils/fetch'
import { Symbols } from '../symbols'
import { AgentConfig } from '../agent/AgentConfig'

export class HttpOutboundTransporter implements OutboundTransporter {
  private agent: Agent
  private logger: Logger
  private agentConfig: AgentConfig

  public supportedSchemes = ['http', 'https']

  public constructor(agent: Agent) {
    // TODO: maybe we can let the transport constructed using
    // the dependency injection container. For now just
    // just resolve the dependency from the agent

    this.agent = agent
    this.agentConfig = agent.injectionContainer.resolve(AgentConfig)
    this.logger = agent.injectionContainer.resolve(Symbols.Logger)
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
        headers: { 'Content-Type': this.agentConfig.didCommMimeType },
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
        didCommMimeType: this.agentConfig.didCommMimeType,
      })
    }
  }
}
