import { EventEmitter } from 'events';
import { OutboundMessage } from '../../types';
import { createOutboundMessage } from '../helpers';
import { Repository } from '../../storage/Repository';
import { BasicMessageRecord } from '../../storage/BasicMessageRecord';
import { ConnectionRecord } from '../../storage/ConnectionRecord';
import { BasicMessage } from './BasicMessage';
import { InboundMessageContext } from '../../agent/models/InboundMessageContext';

enum EventType {
  MessageReceived = 'messageReceived',
}

class BasicMessageService extends EventEmitter {
  basicMessageRepository: Repository<BasicMessageRecord>;

  constructor(basicMessageRepository: Repository<BasicMessageRecord>) {
    super();
    this.basicMessageRepository = basicMessageRepository;
  }

  async send(message: string, connection: ConnectionRecord): Promise<OutboundMessage<BasicMessage>> {
    const basicMessage = new BasicMessage({
      content: message,
    });

    const basicMessageRecord = new BasicMessageRecord({
      id: basicMessage.id,
      sent_time: basicMessage.sentTime.toISOString(),
      content: basicMessage.content,
      tags: { from: connection.did || '', to: connection.theirDid || '' },
    });

    await this.basicMessageRepository.save(basicMessageRecord);
    return createOutboundMessage(connection, basicMessage);
  }

  /**
   * @todo use connection from message context
   */
  async save({ message }: InboundMessageContext<BasicMessage>, connection: ConnectionRecord) {
    const basicMessageRecord = new BasicMessageRecord({
      id: message.id,
      sent_time: message.sentTime.toISOString(),
      content: message.content,
      tags: { from: connection.theirDid || '', to: connection.did || '' },
    });

    await this.basicMessageRepository.save(basicMessageRecord);
    this.emit(EventType.MessageReceived, { verkey: connection.verkey, message });
  }

  async findAllByQuery(query: WalletQuery) {
    return this.basicMessageRepository.findByQuery(query);
  }
}

export { BasicMessageService, EventType };
