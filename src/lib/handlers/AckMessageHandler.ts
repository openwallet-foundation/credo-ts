import { InboundMessage, TYPES } from '../types';
import { Handler } from './Handler';
import { ConnectionService } from '../protocols/connections/ConnectionService';
import { inject, injectable } from 'inversify';

@injectable()
export class AckMessageHandler implements Handler {
  connectionService: ConnectionService;

  constructor(@inject(TYPES.ConnectionService) connectionService: ConnectionService) {
    this.connectionService = connectionService;
  }

  async handle(inboundMessage: InboundMessage) {
    const outboundMessage = await this.connectionService.acceptAck(inboundMessage);
    return outboundMessage;
  }
}
