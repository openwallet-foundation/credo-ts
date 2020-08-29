import { Handler, HandlerInboundMessage } from '../Handler';
import { ConnectionService } from '../../protocols/connections/ConnectionService';
import { ConnectionResponseMessage } from '../../protocols/connections/ConnectionResponseMessage';

export class ConnectionResponseHandler implements Handler {
  private connectionService: ConnectionService;
  public supportedMessages = [ConnectionResponseMessage];

  public constructor(connectionService: ConnectionService) {
    this.connectionService = connectionService;
  }

  public async handle(inboundMessage: HandlerInboundMessage<ConnectionResponseHandler>) {
    const outboudMessage = await this.connectionService.acceptResponse(inboundMessage);
    return outboudMessage;
  }
}
