import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { TrustPingService } from '../services/TrustPingService'

import { TrustPingResponseMessageV2 } from '../messages/TrustPingResponseV2Message'

export class TrustPingResponseV2MessageHandler implements Handler {
  private trustPingService: TrustPingService
  public supportedMessages = [TrustPingResponseMessageV2]

  public constructor(trustPingService: TrustPingService) {
    this.trustPingService = trustPingService
  }

  public async handle(messageContext: HandlerInboundMessage<TrustPingResponseV2MessageHandler>) {
    return this.trustPingService.processPingResponseV2(messageContext)
  }
}
