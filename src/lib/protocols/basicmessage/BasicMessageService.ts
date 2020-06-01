import { EventEmitter } from 'events';
import { InboundMessage } from '../../types';
import { createOutboundMessage } from '../helpers';
import { createBasicMessage } from './messages';
import { Repository } from '../../storage/Repository';
import { BasicMessageRecord } from '../../storage/BasicMessageRecord';
import { ConnectionRecord } from '../../storage/ConnectionRecord';

enum EventType {
  MessageReceived = 'messageReceived',
}

class BasicMessageService extends EventEmitter {
  basicMessageRepository: Repository<BasicMessageRecord>;

  constructor(basicMessageRepository: Repository<BasicMessageRecord>) {
    super();
    this.basicMessageRepository = basicMessageRepository;
  }

  async send(message: string, connection: ConnectionRecord) {
    const basicMessage = createBasicMessage(message);
    const { sent_time, content } = basicMessage;
    const basicMessageRecord = new BasicMessageRecord({
      id: basicMessage['@id'],
      sent_time,
      content,
      tags: { from: connection.did || '', to: connection.theirDid || '' },
    });
    await this.basicMessageRepository.save(basicMessageRecord);
    return createOutboundMessage(connection, basicMessage);
  }

  async save(inboundMessage: InboundMessage, connection: ConnectionRecord) {
    const { message } = inboundMessage;
    const { id, sent_time, content } = message;
    const basicMessageRecord = new BasicMessageRecord({
      id,
      sent_time,
      content,
      tags: { from: connection.theirDid || '', to: connection.did || '' },
    });
    await this.basicMessageRepository.save(basicMessageRecord);
    this.emit(EventType.MessageReceived, { verkey: connection.verkey, message });
    return null;
  }
}

export { BasicMessageService, EventType };
