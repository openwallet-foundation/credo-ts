import { Handler, HandlerInboundMessage } from '../Handler';
import { ConnectionService } from '../../protocols/connections/ConnectionService';
import { MessagePickupService } from '../../protocols/messagepickup/MessagePickupService';
import { BatchPickupMessage } from '../../protocols/messagepickup/BatchPickupMessage';

export class MessagePickupHandler implements Handler {
  connectionService: ConnectionService;
  messagePickupService: MessagePickupService;
  supportedMessages = [BatchPickupMessage];

  constructor(connectionService: ConnectionService, messagePickupService: MessagePickupService) {
    this.connectionService = connectionService;
    this.messagePickupService = messagePickupService;
  }

  async handle(inboundMessage: HandlerInboundMessage<MessagePickupHandler>) {
    const { recipient_verkey } = inboundMessage;
    const connection = await this.connectionService.findByVerkey(recipient_verkey);

    if (!connection) {
      throw new Error(`Connection for verkey ${recipient_verkey} not found!`);
    }

    const outboundMessage = this.messagePickupService.batch(connection);
    return outboundMessage;
  }
}
