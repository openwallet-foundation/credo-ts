import { Handler, HandlerInboundMessage } from '../Handler';
import { ConnectionService } from '../../protocols/connections/ConnectionService';
import { ConnectionRequestMessage } from '../../protocols/connections/ConnectionRequestMessage';

export class ConnectionRequestHandler implements Handler {
  connectionService: ConnectionService;
  supportedMessages = [ConnectionRequestMessage];

  constructor(connectionService: ConnectionService) {
    this.connectionService = connectionService;
  }

  async handle(inboundMessage: HandlerInboundMessage<ConnectionRequestHandler>) {
    const outboudMessage = await this.connectionService.acceptRequest(inboundMessage);
    return outboudMessage;
  }
}
