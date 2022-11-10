import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { TrustPingService } from '../services/TrustPingService'

import { TrustPingMessageV2 } from '../messages/TrustPingV2Message'

export class TrustPingV2MessageHandler implements Handler {
  private trustPingService: TrustPingService
  public supportedMessages = [TrustPingMessageV2]

  public constructor(trustPingService: TrustPingService) {
    this.trustPingService = trustPingService
  }

  public async handle(messageContext: HandlerInboundMessage<TrustPingV2MessageHandler>) {
    return this.trustPingService.processPingV2(messageContext)
  }
}
