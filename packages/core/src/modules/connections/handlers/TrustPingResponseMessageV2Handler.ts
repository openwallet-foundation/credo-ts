import type { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import type { TrustPingService } from '../services/TrustPingService'

import { TrustPingResponseMessageV2 } from '../messages'

export class TrustPingResponseMessageV2Handler implements Handler {
  private trustPingService: TrustPingService
  public supportedMessages = [TrustPingResponseMessageV2]

  public constructor(trustPingService: TrustPingService) {
    this.trustPingService = trustPingService
  }

  public async handle(inboundMessage: HandlerInboundMessage<TrustPingResponseMessageV2Handler>) {
    return this.trustPingService.processTrustPingResponseV2(inboundMessage)
  }
}
