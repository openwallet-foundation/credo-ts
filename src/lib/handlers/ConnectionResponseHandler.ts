import { InboundMessage, TYPES } from '../types';
import { Handler } from './Handler';
import { ConnectionService } from '../protocols/connections/ConnectionService';
import { injectable, inject } from 'inversify';

@injectable()
export class ConnectionResponseHandler implements Handler {
  connectionService: ConnectionService;

  constructor(@inject(TYPES.ConnectionService) connectionService: ConnectionService) {
    this.connectionService = connectionService;
  }

  async handle(inboundMessage: InboundMessage) {
    const outboudMessage = await this.connectionService.acceptResponse(inboundMessage);
    return outboudMessage;
  }
}
