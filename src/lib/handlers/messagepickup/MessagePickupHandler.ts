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

  async handle(messageContext: HandlerInboundMessage<MessagePickupHandler>) {
    if (!messageContext.connection) {
      throw new Error(`Connection for verkey ${messageContext.recipientVerkey} not found!`);
    }

    return this.messagePickupService.batch(messageContext.connection);
  }
}
