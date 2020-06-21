import { Handler, HandlerInboundMessage } from '../Handler';
import { ConnectionService } from '../../protocols/connections/ConnectionService';
import { AckMessage } from '../../protocols/connections/AckMessage';

export class AckMessageHandler implements Handler {
  connectionService: ConnectionService;
  supportedMessages = [AckMessage];

  constructor(connectionService: ConnectionService) {
    this.connectionService = connectionService;
  }

  async handle(inboundMessage: HandlerInboundMessage<AckMessageHandler>) {
    await this.connectionService.acceptAck(inboundMessage);
  }
}
