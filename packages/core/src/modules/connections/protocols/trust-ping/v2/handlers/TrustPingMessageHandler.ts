import type { MessageHandler, MessageHandlerInboundMessage } from '../../../../../../agent/MessageHandler'
import type { V2TrustPingService } from '../V2TrustPingService'

import { OutboundMessageContext } from '../../../../../../agent/models'
import { TrustPingMessage } from '../messages/TrustPingMessage'

export class TrustPingMessageHandler implements MessageHandler {
  private v2TrustPingService: V2TrustPingService
  public supportedMessages = [TrustPingMessage]

  public constructor(trustPingService: V2TrustPingService) {
    this.v2TrustPingService = trustPingService
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
