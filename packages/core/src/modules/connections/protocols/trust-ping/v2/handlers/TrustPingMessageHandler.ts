import type { Handler, HandlerInboundMessage } from '../../../../../../agent/Handler'
import type { V2TrustPingService } from '../V2TrustPingService'

import { OutboundMessageContext } from '../../../../../../agent/models'
import { TrustPingMessage } from '../messages/TrustPingMessage'

export class TrustPingMessageHandler implements Handler {
  private v2TrustPingService: V2TrustPingService
  public supportedMessages = [TrustPingMessage]

  public constructor(trustPingService: V2TrustPingService) {
    this.v2TrustPingService = trustPingService
  }

  public async handle(messageContext: HandlerInboundMessage<TrustPingMessageHandler>) {
    const message = await this.v2TrustPingService.processPing(messageContext)
    if (message) {
      return new OutboundMessageContext(message, {
        agentContext: messageContext.agentContext,
      })
    }
  }
}
