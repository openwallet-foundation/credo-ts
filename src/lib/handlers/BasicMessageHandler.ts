import { InboundMessage, TYPES } from '../types';
import { Handler } from './Handler';
import { ConnectionService } from '../protocols/connections/ConnectionService';
import { BasicMessageService } from '../protocols/basicmessage/BasicMessageService';
import { injectable, inject } from 'inversify';

@injectable()
export class BasicMessageHandler implements Handler {
  connectionService: ConnectionService;
  basicMessageService: BasicMessageService;

  constructor(
    @inject(TYPES.ConnectionService) connectionService: ConnectionService,
    @inject(TYPES.BasicMessageService) basicMessageService: BasicMessageService
  ) {
    this.connectionService = connectionService;
    this.basicMessageService = basicMessageService;
  }

  async handle(inboundMessage: InboundMessage) {
    const { recipient_verkey } = inboundMessage;
    const connection = this.connectionService.findByVerkey(recipient_verkey);

    if (!connection) {
      throw new Error(`Connection for verkey ${recipient_verkey} not found!`);
    }

    if (!connection.theirKey) {
      throw new Error(`Connection with verkey ${connection.verkey} has no recipient keys.`);
    }

    const outboundMessage = this.basicMessageService.save(inboundMessage, connection);
    return outboundMessage;
  }
}
