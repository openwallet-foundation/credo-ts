import { Handler, HandlerInboundMessage } from '../Handler';
import { TrustPingService } from '../../protocols/trustping/TrustPingService';
import { ConnectionService } from '../../protocols/connections/ConnectionService';
import { ConnectionState } from '../../protocols/connections/domain/ConnectionState';
import { TrustPingMessage } from '../../protocols/trustping/TrustPingMessage';

export class TrustPingMessageHandler implements Handler {
  trustPingService: TrustPingService;
  connectionService: ConnectionService;
  supportedMessages = [TrustPingMessage];

  constructor(trustPingService: TrustPingService, connectionService: ConnectionService) {
    this.trustPingService = trustPingService;
    this.connectionService = connectionService;
  }

  async handle(inboundMessage: HandlerInboundMessage<TrustPingMessageHandler>) {
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
