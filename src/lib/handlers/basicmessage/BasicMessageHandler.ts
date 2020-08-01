import { Handler, HandlerInboundMessage } from '../Handler';
import { ConnectionService } from '../../protocols/connections/ConnectionService';
import { BasicMessageService } from '../../protocols/basicmessage/BasicMessageService';
import { BasicMessage } from '../../protocols/basicmessage/BasicMessage';

export class BasicMessageHandler implements Handler {
  connectionService: ConnectionService;
  basicMessageService: BasicMessageService;
  supportedMessages = [BasicMessage];

  constructor(connectionService: ConnectionService, basicMessageService: BasicMessageService) {
    this.connectionService = connectionService;
    this.basicMessageService = basicMessageService;
  }

  async handle(messageContext: HandlerInboundMessage<BasicMessageHandler>) {
    const connection = messageContext.connection;

    if (!connection) {
      throw new Error(`Connection for verkey ${messageContext.recipientVerkey} not found!`);
    }

    if (!connection.theirKey) {
      throw new Error(`Connection with verkey ${connection.verkey} has no recipient keys.`);
    }

    await this.basicMessageService.save(messageContext, connection);
  }
}
