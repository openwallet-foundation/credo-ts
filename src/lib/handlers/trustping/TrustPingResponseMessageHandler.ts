import { Handler } from '../Handler';
import { InboundMessage } from '../../types';
import { TrustPingService } from '../../protocols/trustping/TrustPingService';
import { MessageType } from '../../protocols/trustping/messages';

export class TrustPingResponseMessageHandler implements Handler {
  trustPingService: TrustPingService;

  constructor(trustPingService: TrustPingService) {
    this.trustPingService = trustPingService;
  }

  get supportedMessageTypes(): [MessageType.TrustPingResponseMessage] {
    return [MessageType.TrustPingResponseMessage];
  }

  async handle(inboundMessage: InboundMessage) {
    return this.trustPingService.processPingResponse(inboundMessage);
  }
}
