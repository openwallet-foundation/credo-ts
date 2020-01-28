import { Handler } from './Handler';
import { InboundMessage } from '../types';
import { TrustPingService } from '../protocols/trustping/TrustPingService';
import { ConnectionService } from '../protocols/connections/ConnectionService';
import { MessageType } from '../protocols/trustping/messages';

export class TrustPingHandler implements Handler {
  trustPingService: TrustPingService;
  connectionService: ConnectionService;

  constructor(trustPingService: TrustPingService, connectionService: ConnectionService) {
    this.trustPingService = trustPingService;
    this.connectionService = connectionService;
  }

  async handle(inboundMessage: InboundMessage) {
    switch (inboundMessage.message['@type']) {
      case MessageType.TrustPingMessage:
        const { recipient_verkey } = inboundMessage;
        const connection = this.connectionService.findByVerkey(recipient_verkey);
        if (!connection) {
          throw new Error(`Connection for receipient_verkey ${recipient_verkey} not found`);
        }
        return this.trustPingService.process_ping(inboundMessage, connection);
      case MessageType.TrustPingResponseMessage:
        return this.trustPingService.process_ping_response(inboundMessage);
      default:
        throw new Error('Invalid message type for handler');
    }
  }
}
