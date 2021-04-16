import { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import { TrustPingService } from '../services/TrustPingService'
import { TrustPingResponseMessage } from '../messages'

export class TrustPingResponseMessageHandler implements Handler {
  private trustPingService: TrustPingService
  public supportedMessages = [TrustPingResponseMessage]

  public constructor(trustPingService: TrustPingService) {
    this.trustPingService = trustPingService
  }

  public async handle(inboundMessage: HandlerInboundMessage<TrustPingResponseMessageHandler>) {
    return this.trustPingService.processPingResponse(inboundMessage)
  }
}
