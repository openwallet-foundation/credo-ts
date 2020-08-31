import { Handler, HandlerInboundMessage } from '../Handler';
import { MessagePickupService } from '../../protocols/messagepickup/MessagePickupService';
import { BatchPickupMessage } from '../../protocols/messagepickup/BatchPickupMessage';

export class MessagePickupHandler implements Handler {
  private messagePickupService: MessagePickupService;
  public supportedMessages = [BatchPickupMessage];

  public constructor(messagePickupService: MessagePickupService) {
    this.messagePickupService = messagePickupService;
  }

  public async handle(messageContext: HandlerInboundMessage<MessagePickupHandler>) {
    if (!messageContext.connection) {
      throw new Error(`Connection for verkey ${messageContext.recipientVerkey} not found!`);
    }

    return this.messagePickupService.batch(messageContext.connection);
  }
}
