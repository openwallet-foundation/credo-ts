import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../handlers'
import type { DidCommTrustPingService } from '../services'

import { TrustPingResponseMessage } from '../messages'

export class TrustPingResponseMessageHandler implements DidCommMessageHandler {
  private trustPingService: DidCommTrustPingService
  public supportedMessages = [TrustPingResponseMessage]

  public constructor(trustPingService: DidCommTrustPingService) {
    this.trustPingService = trustPingService
  }

  public async handle(inboundMessage: DidCommMessageHandlerInboundMessage<TrustPingResponseMessageHandler>) {
    await this.trustPingService.processPingResponse(inboundMessage)

    return undefined
  }
}
