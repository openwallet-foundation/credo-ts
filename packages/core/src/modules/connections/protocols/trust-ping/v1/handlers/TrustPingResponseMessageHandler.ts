import type { MessageHandler, MessageHandlerInboundMessage } from '../../../../../../agent/MessageHandler'
import type { V1TrustPingService } from '../V1TrustPingService'

import { TrustPingResponseMessage } from '../messages'

export class TrustPingResponseMessageHandler implements MessageHandler {
  private trustPingService: V1TrustPingService
  public supportedMessages = [TrustPingResponseMessage]

  public constructor(trustPingService: V1TrustPingService) {
    this.trustPingService = trustPingService
  }

  public async handle(inboundMessage: MessageHandlerInboundMessage<TrustPingResponseMessageHandler>) {
    return this.trustPingService.processPingResponse(inboundMessage)
  }
}
