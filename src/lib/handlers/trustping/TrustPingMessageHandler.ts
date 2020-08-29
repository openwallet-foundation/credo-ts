import { Handler, HandlerInboundMessage } from '../Handler';
import { TrustPingService } from '../../protocols/trustping/TrustPingService';
import { ConnectionService } from '../../protocols/connections/ConnectionService';
import { ConnectionState } from '../../protocols/connections/domain/ConnectionState';
import { TrustPingMessage } from '../../protocols/trustping/TrustPingMessage';

export class TrustPingMessageHandler implements Handler {
  private trustPingService: TrustPingService;
  private connectionService: ConnectionService;
  public supportedMessages = [TrustPingMessage];

  public constructor(trustPingService: TrustPingService, connectionService: ConnectionService) {
    this.trustPingService = trustPingService;
    this.connectionService = connectionService;
  }

  public async handle(messageContext: HandlerInboundMessage<TrustPingMessageHandler>) {
    const { connection, recipientVerkey } = messageContext;
    if (!connection) {
      throw new Error(`Connection for verkey ${recipientVerkey} not found!`);
    }

    if (connection.state != ConnectionState.COMPLETE) {
      await this.connectionService.updateState(connection, ConnectionState.COMPLETE);
    }

    return this.trustPingService.processPing(messageContext, connection);
  }
}
