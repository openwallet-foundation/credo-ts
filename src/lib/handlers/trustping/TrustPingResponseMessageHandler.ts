import { Handler } from '../Handler';
import { InboundMessage } from '../../types';
import { TrustPingService } from '../../protocols/trustping/TrustPingService';

export class TrustPingResponseMessageHandler implements Handler {
  trustPingService: TrustPingService;

  constructor(trustPingService: TrustPingService) {
    this.trustPingService = trustPingService;
  }

  async handle(inboundMessage: InboundMessage) {
    return this.trustPingService.processPingResponse(inboundMessage);
  }
}
