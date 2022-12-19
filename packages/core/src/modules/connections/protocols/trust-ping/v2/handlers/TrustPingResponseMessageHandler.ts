import type { MessageHandler, MessageHandlerInboundMessage } from '../../../../../../agent/MessageHandler'
import type { V2TrustPingService } from '../V2TrustPingService'

import { TrustPingResponseMessage } from '../messages/TrustPingResponseMessage'

export class TrustPingResponseMessageHandler implements MessageHandler {
  private v2TrustPingService: V2TrustPingService
  public supportedMessages = [TrustPingResponseMessage]

  public constructor(trustPingService: V2TrustPingService) {
    this.v2TrustPingService = trustPingService
  }

  public async handle(messageContext: MessageHandlerInboundMessage<TrustPingResponseMessageHandler>) {
    return this.v2TrustPingService.processPingResponse(messageContext)
  }
}
