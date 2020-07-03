import { Handler, HandlerInboundMessage } from '../Handler';
import { ConnectionService } from '../../protocols/connections/ConnectionService';
import { ConnectionResponseMessage } from '../../protocols/connections/ConnectionResponseMessage';

export class ConnectionResponseHandler implements Handler {
  connectionService: ConnectionService;
  supportedMessages = [ConnectionResponseMessage];

  constructor(connectionService: ConnectionService) {
    this.connectionService = connectionService;
  }

  async handle(inboundMessage: HandlerInboundMessage<ConnectionResponseHandler>) {
    const outboudMessage = await this.connectionService.acceptResponse(inboundMessage);
    return outboudMessage;
  }
}
