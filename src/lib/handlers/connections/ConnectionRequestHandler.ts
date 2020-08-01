import { Handler, HandlerInboundMessage } from '../Handler';
import { ConnectionService } from '../../protocols/connections/ConnectionService';
import { ConnectionRequestMessage } from '../../protocols/connections/ConnectionRequestMessage';

export class ConnectionRequestHandler implements Handler {
  connectionService: ConnectionService;
  supportedMessages = [ConnectionRequestMessage];

  constructor(connectionService: ConnectionService) {
    this.connectionService = connectionService;
  }

  async handle(messageContext: HandlerInboundMessage<ConnectionRequestHandler>) {
    const outboudMessage = await this.connectionService.acceptRequest(messageContext);
    return outboudMessage;
  }
}
