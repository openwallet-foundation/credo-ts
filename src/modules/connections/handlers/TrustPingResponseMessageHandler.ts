import { Handler, HandlerInboundMessage } from '../../../agent/Handler'
import { TrustPingResponseMessage } from '../messages'
import { TrustPingService } from '../services/TrustPingService'

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
