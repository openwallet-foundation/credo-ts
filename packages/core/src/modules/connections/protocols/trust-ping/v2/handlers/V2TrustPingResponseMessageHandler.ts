import type { MessageHandler, MessageHandlerInboundMessage } from '../../../../../../agent/MessageHandler'
import type { V2TrustPingService } from '../V2TrustPingService'

import { V2TrustPingResponseMessage } from '../messages/V2TrustPingResponseMessage'

export class V2TrustPingResponseMessageHandler implements MessageHandler {
  private v2TrustPingService: V2TrustPingService
  public supportedMessages = [V2TrustPingResponseMessage]

  public constructor(trustPingService: V2TrustPingService) {
    this.v2TrustPingService = trustPingService
  }

  public async handle(messageContext: MessageHandlerInboundMessage<V2TrustPingResponseMessageHandler>) {
    return this.v2TrustPingService.processPingResponse(messageContext)
  }
}
