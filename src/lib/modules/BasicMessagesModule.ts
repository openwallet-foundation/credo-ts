import { EventEmitter } from 'events';
import { BasicMessageService } from '../protocols/basicmessage/BasicMessageService';
import { MessageSender } from '../agent/MessageSender';
import { ConnectionRecord } from '../storage/ConnectionRecord';

export class BasicMessagesModule {
  private basicMessageService: BasicMessageService;
  private messageSender: MessageSender;

  public constructor(basicMessageService: BasicMessageService, messageSender: MessageSender) {
    this.basicMessageService = basicMessageService;
    this.messageSender = messageSender;
  }

  public async sendMessage(connection: ConnectionRecord, message: string) {
    const outboundMessage = await this.basicMessageService.send(message, connection);
    await this.messageSender.sendMessage(outboundMessage);
  }

  public async findAllByQuery(query: WalletQuery) {
    return this.basicMessageService.findAllByQuery(query);
  }

  public events(): EventEmitter {
    return this.basicMessageService;
  }
}
