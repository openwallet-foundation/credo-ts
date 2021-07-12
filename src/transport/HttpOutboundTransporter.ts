import type { Agent } from '../agent/Agent'
import type { Logger } from '../logger'
import type { OutboundPackage } from '../types'
import type { OutboundTransporter } from './OutboundTransporter'

import { AbortController } from 'abort-controller'

import { AgentConfig } from '../agent/AgentConfig'
import { AriesFrameworkError } from '../error'
import { fetch } from '../utils/fetch'

export class HttpOutboundTransporter implements OutboundTransporter {
  private agent!: Agent
  private logger!: Logger
  private agentConfig!: AgentConfig

  public supportedSchemes = ['http', 'https']

  public async start(agent: Agent): Promise<void> {
    this.agent = agent
    this.agentConfig = agent.injectionContainer.resolve(AgentConfig)
    this.logger = this.agentConfig.logger

    this.logger.debug('Starting HTTP outbound transport')
  }

  public async stop(): Promise<void> {
    this.logger.debug('Starting HTTP outbound transport')
    // Nothing required to stop HTTP
  }

  public async sendMessage(outboundPackage: OutboundPackage) {
    const { connection, payload, endpoint } = outboundPackage

    if (!endpoint) {
      throw new AriesFrameworkError(`Missing endpoint. I don't know how and where to send the message.`)
    }

    this.logger.debug(`Sending outbound message to connection ${connection.id}`, {
      outboundPackage: payload,
      endpoint: endpoint,
    })

    try {
      const abortController = new AbortController()
      const id = setTimeout(() => abortController.abort(), 15000)

      const response = await fetch(endpoint, {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: { 'Content-Type': this.agentConfig.didCommMimeType },
        signal: abortController.signal,
      })
      clearTimeout(id)

      const responseMessage = await response.text()

      // TODO: do we just want to ignore messages that were returned if we didn't request it?
      // TODO: check response header type (and also update inbound transports to use the correct headers types)
      if (responseMessage) {
        this.logger.debug(`Response received`, { responseMessage, status: response.status })

        try {
          const wireMessage = JSON.parse(responseMessage)
          this.agent.receiveMessage(wireMessage)
        } catch (error) {
          this.logger.debug('Unable to parse response message')
        }
      } else {
        this.logger.debug(`No response received.`)
      }
    } catch (error) {
      this.logger.error(`Error sending message to ${endpoint}: ${error.message}`, {
        error,
        message: error.message,
        body: payload,
        didCommMimeType: this.agentConfig.didCommMimeType,
      })
    }
  }
}
