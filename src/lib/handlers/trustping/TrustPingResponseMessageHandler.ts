import { Handler, HandlerInboundMessage } from '../Handler';
import { TrustPingService } from '../../protocols/trustping/TrustPingService';
import { TrustPingResponseMessage } from '../../protocols/trustping/TrustPingResponseMessage';

export class TrustPingResponseMessageHandler implements Handler {
  trustPingService: TrustPingService;
  supportedMessages = [TrustPingResponseMessage];

  constructor(trustPingService: TrustPingService) {
    this.trustPingService = trustPingService;
  }

  async handle(inboundMessage: HandlerInboundMessage<TrustPingResponseMessageHandler>) {
    return this.trustPingService.processPingResponse(inboundMessage);
  }
}
