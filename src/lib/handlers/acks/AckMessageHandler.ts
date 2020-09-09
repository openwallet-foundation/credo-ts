import { Handler, HandlerInboundMessage } from '../Handler';
import { ConnectionService } from '../../protocols/connections/ConnectionService';
import { AckMessage } from '../../protocols/connections/AckMessage';

export class AckMessageHandler implements Handler {
  private connectionService: ConnectionService;
  public supportedMessages = [AckMessage];

  public constructor(connectionService: ConnectionService) {
    this.connectionService = connectionService;
  }

  public async handle(inboundMessage: HandlerInboundMessage<AckMessageHandler>) {
    await this.connectionService.processAck(inboundMessage);
  }
}
