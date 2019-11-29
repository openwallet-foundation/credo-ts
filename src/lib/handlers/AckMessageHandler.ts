import { InboundMessage } from '../types';
import { Handler } from './Handler';
import { ConnectionService } from '../protocols/connections/ConnectionService';

export class AckMessageHandler implements Handler {
  connectionService: ConnectionService;

  constructor(connectionService: ConnectionService) {
    this.connectionService = connectionService;
  }

  async handle(inboundMessage: InboundMessage) {
    const outboundMessage = await this.connectionService.acceptAck(inboundMessage);
    return outboundMessage;
  }
}
