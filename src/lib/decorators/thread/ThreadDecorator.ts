import { Expose } from 'class-transformer';
import { Matches } from 'class-validator';
import { MessageIdRegExp } from '../../agent/AgentMessage';

/**
 * Represents `~thread` decorator
 * @see https://github.com/hyperledger/aries-rfcs/blob/master/concepts/0008-message-id-and-threading/README.md
 */
export class ThreadDecorator {
  constructor(partial?: Partial<ThreadDecorator>) {
    this.threadId = partial?.threadId;
    this.parentThreadId = partial?.parentThreadId;
    this.senderOrder = partial?.senderOrder;
    this.receivedOrders = partial?.receivedOrders;
  }

  /**
   * The ID of the message that serves as the thread start.
   */
  @Expose({ name: 'thid' })
  @Matches(MessageIdRegExp)
  threadId?: string;

  /**
   * An optional parent `thid`. Used when branching or nesting a new interaction off of an existing one.
   */
  @Expose({ name: 'pthid' })
  @Matches(MessageIdRegExp)
  parentThreadId?: string;

  /**
   * A number that tells where this message fits in the sequence of all messages that the current sender has contributed to this thread.
   */
  @Expose({ name: 'sender_order' })
  senderOrder?: number;

  /**
   * Reports the highest `sender_order` value that the sender has seen from other sender(s) on the thread.
   * This value is often missing if it is the first message in an interaction, but should be used otherwise, as it provides an implicit ACK.
   */
  @Expose({ name: 'received_orders' })
  receivedOrders?: { [key: string]: number };
}
