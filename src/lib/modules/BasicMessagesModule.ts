import { BasicMessageService } from '../protocols/basicmessage/BasicMessageService';
import { MessageSender } from '../agent/MessageSender';
import { ConnectionRecord } from '../storage/ConnectionRecord';

export class BasicMessagesModule {
  basicMessageService: BasicMessageService;
  messageSender: MessageSender;

  constructor(basicMessageService: BasicMessageService, messageSender: MessageSender) {
    this.basicMessageService = basicMessageService;
    this.messageSender = messageSender;
  }

  async sendMessage(connection: ConnectionRecord, message: string) {
    const outboundMessage = await this.basicMessageService.send(message, connection);
    await this.messageSender.sendMessage(outboundMessage);
  }

  async findAllByQuery(query: {}) {
    return this.basicMessageService.findAllByQuery(query);
  }
}
