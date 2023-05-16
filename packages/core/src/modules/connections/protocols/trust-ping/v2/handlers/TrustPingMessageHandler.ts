import type { MessageHandler, MessageHandlerInboundMessage } from '../../../../../../agent/MessageHandler'
import type { ConnectionService } from '../../../../services/ConnectionService'
import type { V2TrustPingService } from '../V2TrustPingService'

import { OutboundMessageContext } from '../../../../../../agent/models'
import { TrustPingMessage } from '../messages/TrustPingMessage'

export class TrustPingMessageHandler implements MessageHandler {
  private v2TrustPingService: V2TrustPingService
  private connectionService: ConnectionService
  public supportedMessages = [TrustPingMessage]

  public constructor(trustPingService: V2TrustPingService, connectionService: ConnectionService) {
    this.v2TrustPingService = trustPingService
    this.connectionService = connectionService
  }

  public async handle(messageContext: MessageHandlerInboundMessage<TrustPingMessageHandler>) {
    const message = await this.v2TrustPingService.processPing(messageContext)

    if (message) {
      return new OutboundMessageContext(message, {
        agentContext: messageContext.agentContext,
      })
    }
  }
}
