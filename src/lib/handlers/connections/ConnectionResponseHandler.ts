import { InboundMessage } from '../../types';
import { Handler } from '../Handler';
import { ConnectionService } from '../../protocols/connections/ConnectionService';

export class ConnectionResponseHandler implements Handler {
  connectionService: ConnectionService;

  constructor(connectionService: ConnectionService) {
    this.connectionService = connectionService;
  }

  async handle(inboundMessage: InboundMessage) {
    const outboudMessage = await this.connectionService.acceptResponse(inboundMessage);
    return outboudMessage;
  }
}
