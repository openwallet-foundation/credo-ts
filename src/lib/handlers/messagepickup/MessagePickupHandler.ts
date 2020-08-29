import { Handler, HandlerInboundMessage } from '../Handler';
import { ConnectionService } from '../../protocols/connections/ConnectionService';
import { MessagePickupService } from '../../protocols/messagepickup/MessagePickupService';
import { BatchPickupMessage } from '../../protocols/messagepickup/BatchPickupMessage';

export class MessagePickupHandler implements Handler {
  private connectionService: ConnectionService;
  private messagePickupService: MessagePickupService;
  public supportedMessages = [BatchPickupMessage];

  public constructor(connectionService: ConnectionService, messagePickupService: MessagePickupService) {
    this.connectionService = connectionService;
    this.messagePickupService = messagePickupService;
  }

  public async handle(messageContext: HandlerInboundMessage<MessagePickupHandler>) {
    if (!messageContext.connection) {
      throw new Error(`Connection for verkey ${messageContext.recipientVerkey} not found!`);
    }

    return this.messagePickupService.batch(messageContext.connection);
  }
}
