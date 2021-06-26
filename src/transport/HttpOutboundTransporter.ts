import type { Agent } from '../agent/Agent'
import type { Logger } from '../logger'
import type { OutboundPackage } from '../types'
import type { OutboundTransporter } from './OutboundTransporter'

import { AgentConfig } from '../agent/AgentConfig'
import { InjectionSymbols } from '../constants'
import { fetch } from '../utils/fetch'

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
    this.logger = agent.injectionContainer.resolve(InjectionSymbols.Logger)
  }

  public async start(): Promise<void> {
    // Nothing required to start HTTP
  }

  public async stop(): Promise<void> {
    // Nothing required to stop HTTP
  }

  public async sendMessage(outboundPackage: OutboundPackage) {
    const { payload, endpoint, responseRequested } = outboundPackage

    if (!endpoint) {
      throw new Error(`Missing endpoint. I don't know how and where to send the message.`)
    }

    this.logger.debug(`Sending outbound message to endpoint '${outboundPackage.endpoint}'`, {
      payload: outboundPackage.payload,
      connectionId: outboundPackage.connection?.id,
    })

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
