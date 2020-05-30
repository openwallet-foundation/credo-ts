import { InboundConnection } from '../../types';
import { createOutboundMessage } from '../helpers';
import { createBatchPickupMessage, createBatchMessage } from './messages';
import { MessageRepository } from '../../storage/MessageRepository';
import { ConnectionRecord } from '../../storage/ConnectionRecord';

export class MessagePickupService {
  messageRepository?: MessageRepository;

  constructor(messageRepository?: MessageRepository) {
    this.messageRepository = messageRepository;
  }

  async batchPickup(inboundConnection: InboundConnection) {
    const batchPickupMessage = createBatchPickupMessage();
    return createOutboundMessage(inboundConnection.connection, batchPickupMessage);
  }

  async batch(connection: ConnectionRecord) {
    if (!this.messageRepository) {
      throw new Error('There is no message repository.');
    }
    if (!connection.theirKey) {
      throw new Error('Trying to find messages to connection without theirKey!');
    }
    const messages = await this.messageRepository.findByVerkey(connection.theirKey);
    const batchMessage = createBatchMessage(messages);
    await this.messageRepository.deleteAllByVerkey(connection.theirKey); // TODO Maybe, don't delete, but just marked them as read
    return createOutboundMessage(connection, batchMessage);
  }
}
