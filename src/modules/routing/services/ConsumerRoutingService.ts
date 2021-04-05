import type { Verkey } from 'indy-sdk'
import { createOutboundMessage } from '../../../agent/helpers'
import { AgentConfig } from '../../../agent/AgentConfig'
import { MessageSender } from '../../../agent/MessageSender'
import { KeylistUpdateMessage, KeylistUpdate, KeylistUpdateAction } from '../messages'
import { Logger } from '../../../logger'

class ConsumerRoutingService {
  private messageSender: MessageSender
  private logger: Logger
  private agentConfig: AgentConfig

  public constructor(messageSender: MessageSender, agentConfig: AgentConfig) {
    this.messageSender = messageSender
    this.agentConfig = agentConfig
    this.logger = agentConfig.logger
  }

  public async createRoute(verkey: Verkey) {
    this.logger.debug(`Registering route for verkey '${verkey}' at mediator`)

    if (!this.agentConfig.inboundConnection) {
      this.logger.debug(`There is no mediator. Creating route for verkey '${verkey}' skipped.`)
    } else {
      const routingConnection = this.agentConfig.inboundConnection.connection

      const keylistUpdateMessage = new KeylistUpdateMessage({
        updates: [
          new KeylistUpdate({
            action: KeylistUpdateAction.add,
            recipientKey: verkey,
          }),
        ],
      })

      const outboundMessage = createOutboundMessage(routingConnection, keylistUpdateMessage)
      await this.messageSender.sendMessage(outboundMessage)
    }
  }
}

export { ConsumerRoutingService }
