import { InboundMessage } from '../../types';
import { Handler } from '../Handler';
import { ConnectionService } from '../../protocols/connections/ConnectionService';
import { MessageType } from '../../protocols/connections/messages';

export class ConnectionResponseHandler implements Handler {
  connectionService: ConnectionService;

  constructor(connectionService: ConnectionService) {
    this.connectionService = connectionService;
  }

  get supportedMessageTypes(): [MessageType.ConnectionResponse] {
    return [MessageType.ConnectionResponse];
  }

  async handle(inboundMessage: InboundMessage) {
    const outboudMessage = await this.connectionService.acceptResponse(inboundMessage);
    return outboudMessage;
  }
}
