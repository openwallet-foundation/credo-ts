import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { TrustPingService } from '../services/TrustPingService'

import { TrustPingMessageV2 } from '../messages'

export class TrustPingMessageV2Handler implements Handler {
  private trustPingService: TrustPingService
  public supportedMessages = [TrustPingMessageV2]

  public constructor(trustPingService: TrustPingService) {
    this.trustPingService = trustPingService
  }

  public async handle(messageContext: HandlerInboundMessage<TrustPingMessageV2Handler>) {
    return this.trustPingService.processTrustPingV2(messageContext)
  }
}
