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

  async handle(inboundMessage: HandlerInboundMessage<BasicMessageHandler>) {
    const { recipient_verkey } = inboundMessage;
    const connection = await this.connectionService.findByVerkey(recipient_verkey);

    if (!connection) {
      throw new Error(`Connection for verkey ${recipient_verkey} not found!`);
    }

    if (!connection.theirKey) {
      throw new Error(`Connection with verkey ${connection.verkey} has no recipient keys.`);
    }

    await this.basicMessageService.save(inboundMessage, connection);
  }
}
