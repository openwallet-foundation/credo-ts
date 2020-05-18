import { InboundMessage } from '../../types';
import { Handler } from '../Handler';
import { ConnectionService } from '../../protocols/connections/ConnectionService';
import { MessageType } from '../../protocols/connections/messages';

export class AckMessageHandler implements Handler {
  connectionService: ConnectionService;

  constructor(connectionService: ConnectionService) {
    this.connectionService = connectionService;
  }

  get supportedMessageTypes(): [MessageType.Ack] {
    return [MessageType.Ack];
  }

  async handle(inboundMessage: InboundMessage) {
    const outboundMessage = await this.connectionService.acceptAck(inboundMessage);
    return outboundMessage;
  }
}
