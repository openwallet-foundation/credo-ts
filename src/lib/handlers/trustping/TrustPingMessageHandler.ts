import { Handler } from '../Handler';
import { InboundMessage } from '../../types';
import { TrustPingService } from '../../protocols/trustping/TrustPingService';
import { ConnectionService } from '../../protocols/connections/ConnectionService';
import { MessageType } from '../../protocols/trustping/messages';
import { ConnectionState } from '../../protocols/connections/domain/ConnectionState';

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
    const connectionRecord = await this.connectionService.findByVerkey(recipient_verkey);
    if (!connectionRecord) {
      throw new Error(`Connection for recipient_verkey ${recipient_verkey} not found`);
    }
    if (connectionRecord.state != ConnectionState.COMPLETE) {
      await this.connectionService.updateState(connectionRecord, ConnectionState.COMPLETE);
    }
    return this.trustPingService.processPing(inboundMessage, connectionRecord);
  }
}
