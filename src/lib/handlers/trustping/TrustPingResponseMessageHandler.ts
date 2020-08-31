import { Handler, HandlerInboundMessage } from '../Handler';
import { TrustPingService } from '../../protocols/trustping/TrustPingService';
import { TrustPingResponseMessage } from '../../protocols/trustping/TrustPingResponseMessage';

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
