import { InboundMessage } from '../../types';
import { Handler } from '../Handler';
import { ConnectionService } from '../../protocols/connections/ConnectionService';
import { MessageType } from '../../protocols/connections/messages';

export class ConnectionRequestHandler implements Handler {
  connectionService: ConnectionService;

  constructor(connectionService: ConnectionService) {
    this.connectionService = connectionService;
  }

  get supportedMessageTypes(): [MessageType.ConnectionRequest] {
    return [MessageType.ConnectionRequest];
  }

  async handle(inboundMessage: InboundMessage) {
    const outboudMessage = await this.connectionService.acceptRequest(inboundMessage);
    return outboudMessage;
  }
}
