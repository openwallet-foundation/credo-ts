import { InboundMessage } from '../../types';
import { Handler } from '../Handler';
import { ConnectionService } from '../../protocols/connections/ConnectionService';
import { MessagePickupService } from '../../protocols/messagepickup/MessagePickupService';
import { MessageType } from '../../protocols/messagepickup/messages';

export class MessagePickupHandler implements Handler {
  connectionService: ConnectionService;
  messagePickupService: MessagePickupService;

  constructor(connectionService: ConnectionService, messagePickupService: MessagePickupService) {
    this.connectionService = connectionService;
    this.messagePickupService = messagePickupService;
  }

  get supportedMessageTypes(): [MessageType.BatchPickup] {
    return [MessageType.BatchPickup];
  }

  async handle(inboundMessage: InboundMessage) {
    const { recipient_verkey } = inboundMessage;
    const connection = await this.connectionService.findByVerkey(recipient_verkey);

    if (!connection) {
      throw new Error(`Connection for verkey ${recipient_verkey} not found!`);
    }

    const outboundMessage = this.messagePickupService.batch(connection);
    return outboundMessage;
  }
}
