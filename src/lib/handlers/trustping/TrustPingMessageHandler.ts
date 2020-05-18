import { Handler } from '../Handler';
import { InboundMessage } from '../../types';
import { TrustPingService } from '../../protocols/trustping/TrustPingService';
import { ConnectionService } from '../../protocols/connections/ConnectionService';
import { MessageType } from '../../protocols/trustping/messages';

export class TrustPingMessageHandler implements Handler {
  trustPingService: TrustPingService;
  connectionService: ConnectionService;

  constructor(trustPingService: TrustPingService, connectionService: ConnectionService) {
    this.trustPingService = trustPingService;
    this.connectionService = connectionService;
  }

  get supportedMessageTypes(): [MessageType.TrustPingMessage] {
    return [MessageType.TrustPingMessage];
  }

  async handle(inboundMessage: InboundMessage) {
    const { recipient_verkey } = inboundMessage;
    const connection = await this.connectionService.findByVerkey(recipient_verkey);
    if (!connection) {
      throw new Error(`Connection for recipient_verkey ${recipient_verkey} not found`);
    }
    return this.trustPingService.processPing(inboundMessage, connection);
  }
}
