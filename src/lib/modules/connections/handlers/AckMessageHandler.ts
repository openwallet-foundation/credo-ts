import { Handler, HandlerInboundMessage } from '../../../handlers/Handler';
import { ConnectionService } from '../services/ConnectionService';
import { AckMessage } from '../messages';

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
