import type { MessageHandler, MessageHandlerInboundMessage } from '../../../../../../agent/MessageHandler'
import type { ConnectionService } from '../../../../services/ConnectionService'
import type { V2TrustPingService } from '../V2TrustPingService'

import { OutboundMessageContext } from '../../../../../../agent/models'
import { AriesFrameworkError } from '../../../../../../error'
import { V2TrustPingMessage } from '../messages/V2TrustPingMessage'

export class V2TrustPingMessageHandler implements MessageHandler {
  private v2TrustPingService: V2TrustPingService
  private connectionService: ConnectionService
  public supportedMessages = [V2TrustPingMessage]

  public constructor(trustPingService: V2TrustPingService, connectionService: ConnectionService) {
    this.v2TrustPingService = trustPingService
    this.connectionService = connectionService
  }

  public async handle(messageContext: MessageHandlerInboundMessage<V2TrustPingMessageHandler>) {
    const { connection, message } = messageContext
    if (!connection) {
      throw new AriesFrameworkError(`Connection for recipient ${message?.firstRecipient} not found!`)
    }

    const response = await this.v2TrustPingService.processPing(messageContext)
    if (response) {
      return new OutboundMessageContext(response, {
        agentContext: messageContext.agentContext,
        connection,
      })
    }
  }
}
