import type { Agent } from '../agent/Agent'
import type { Logger } from '../logger'
import type { OutboundPackage } from '../types'
import type { OutboundTransporter } from './OutboundTransporter'

import { AgentConfig } from '../agent/AgentConfig'
import { InjectionSymbols } from '../constants'

export class WsReactNativeOutboundTransporter implements OutboundTransporter {
  private agent: Agent
  private logger: Logger
  private agentConfig: AgentConfig
  private ws
  public supportedSchemes = ['ws']

  public constructor(agent: Agent) {
    // TODO: maybe we can let the transport constructed using
    // the dependency injection container. For now just
    // just resolve the dependency from the agent

    this.agent = agent
    this.agentConfig = agent.injectionContainer.resolve(AgentConfig)
    this.logger = agent.injectionContainer.resolve(InjectionSymbols.Logger)
    const server = 'HardCodedURL/ChangeMe' // TODO: get from config
    this.ws = new WebSocket(server)
  }

  public async start(): Promise<void> {
    this.ws.onopen = async () => {
      // connection opened
      const connection = await this.agent.mediationRecipient.getDefaultMediatorConnection()
      if (connection) {
        const message = await this.agent.connections.preparePing(connection)
        const payload = {
          topic: 'trustPing',
          //wallet_id: ,
          payload: JSON.stringify(message.payload),
        }
        this.ws.send(JSON.stringify(payload)) // send a ping message
      }
    }

    this.ws.onmessage = (e) => {
      // a message was received
      this.logger.debug(e.data)
      const { topic, wallet_id, payload } = e.data
      try {
        if (payload) {
          this.logger.debug(`Response received:\n ${payload}`)
          const wireMessage = JSON.parse(payload)
          this.agent.receiveMessage(wireMessage)
        } else {
          this.logger.debug(`No response received.`)
        }
      } catch (error) {
        this.logger.error(`errr`, {
          error,
          topic,
          payload,
          wallet_id,
        })
      }
    }

    this.ws.onerror = (e) => {
      // an error occurred
      this.logger.warn(JSON.stringify(e))
    }

    this.ws.onclose = (e) => {
      // connection closed
      this.logger.warn(JSON.stringify(e))
    }
  }

  public async stop(): Promise<void> {
    // Nothing required to stop HTTP
    this.ws.close()
  }

  public async sendMessage(outboundPackage: OutboundPackage) {
    const { payload } = outboundPackage

    this.logger.debug(
      `Sending outbound message to connection ${outboundPackage.connection.id}`,
      outboundPackage.payload
    )

    try {
      const payload_ = {
        topic: 'message',
        //wallet_id: ,
        payload: JSON.stringify(payload),
      }
      this.ws.send(JSON.stringify(payload_))
    } catch (error) {
      this.logger.error(`Error sending message`, {
        error,
        body: payload,
        didCommMimeType: this.agentConfig.didCommMimeType,
      })
    }
  }
}
