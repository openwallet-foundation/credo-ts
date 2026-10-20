import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../handlers'
import { DidCommTrustPingResponseMessage, DidCommTrustPingResponseV2Message } from '../messages'
import type { DidCommTrustPingService } from '../services'

export class DidCommTrustPingResponseMessageHandler implements DidCommMessageHandler {
  private trustPingService: DidCommTrustPingService
  public supportedMessages = [DidCommTrustPingResponseMessage, DidCommTrustPingResponseV2Message]

  public constructor(trustPingService: DidCommTrustPingService) {
    this.trustPingService = trustPingService
  }

  public async handle(inboundMessage: DidCommMessageHandlerInboundMessage<DidCommTrustPingResponseMessageHandler>) {
    await this.trustPingService.processPingResponse(inboundMessage)

    return undefined
  }
}
