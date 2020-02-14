import { Handler } from '../Handler';
import { InboundMessage } from '../../types';
import { TrustPingService } from '../../protocols/trustping/TrustPingService';
import { ConnectionService } from '../../protocols/connections/ConnectionService';

export class TrustPingMessageHandler implements Handler {
  trustPingService: TrustPingService;
  connectionService: ConnectionService;

  constructor(trustPingService: TrustPingService, connectionService: ConnectionService) {
    this.trustPingService = trustPingService;
    this.connectionService = connectionService;
  }

  async handle(inboundMessage: InboundMessage) {
    const { recipient_verkey } = inboundMessage;
    const connection = this.connectionService.findByVerkey(recipient_verkey);
    if (!connection) {
      throw new Error(`Connection for receipient_verkey ${recipient_verkey} not found`);
    }
    return this.trustPingService.processPing(inboundMessage, connection);
  }
}
