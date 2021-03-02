import { Handler, HandlerInboundMessage } from '../../../handlers/Handler';
import { TrustPingService } from '../TrustPingService';
import { TrustPingResponseMessage } from '../messages/TrustPingResponseMessage';

export class TrustPingResponseMessageHandler implements Handler {
  private trustPingService: TrustPingService;
  public supportedMessages = [TrustPingResponseMessage];

  public constructor(trustPingService: TrustPingService) {
    this.trustPingService = trustPingService;
  }

  public async handle(inboundMessage: HandlerInboundMessage<TrustPingResponseMessageHandler>) {
    return this.trustPingService.processPingResponse(inboundMessage);
  }
}
