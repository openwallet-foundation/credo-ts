import { InboundMessage } from '../../types';
import { Handler } from '../Handler';
import { ConnectionService } from '../../protocols/connections/ConnectionService';

export class ConnectionRequestHandler implements Handler {
  connectionService: ConnectionService;

  constructor(connectionService: ConnectionService) {
    this.connectionService = connectionService;
  }

  async handle(inboundMessage: InboundMessage) {
    const outboudMessage = await this.connectionService.acceptRequest(inboundMessage);
    return outboudMessage;
  }
}
