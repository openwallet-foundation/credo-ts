import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../handlers'
import { DidCommTrustPingResponseMessage } from '../messages'
import type { DidCommTrustPingService } from '../services'

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
