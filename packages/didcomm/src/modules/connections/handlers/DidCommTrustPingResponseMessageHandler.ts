import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../handlers'
import type { DidCommTrustPingService } from '../services'

import { DidCommTrustPingResponseMessage } from '../messages'

export class DidCommTrustPingResponseMessageHandler implements DidCommMessageHandler {
  private trustPingService: DidCommTrustPingService
  public supportedMessages = [DidCommTrustPingResponseMessage]

  public constructor(trustPingService: DidCommTrustPingService) {
    this.trustPingService = trustPingService
  }

  public async handle(inboundMessage: DidCommMessageHandlerInboundMessage<DidCommTrustPingResponseMessageHandler>) {
    await this.trustPingService.processPingResponse(inboundMessage)

    return undefined
  }
}
