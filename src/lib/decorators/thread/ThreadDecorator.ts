import { Expose } from 'class-transformer';
import { Matches } from 'class-validator';
import { MessageIdRegExp } from '../../agent/AgentMessage';

/**
 * Represents `~thread` decorator
 */
export class ThreadDecorator {
  constructor(partial?: Partial<ThreadDecorator>) {
    this.threadId = partial?.threadId;
    this.parentThreadId = partial?.parentThreadId;
    this.senderOrder = partial?.senderOrder;
    this.receivedOrders = partial?.receivedOrders;
  }

  @Expose({ name: 'thid' })
  @Matches(MessageIdRegExp)
  threadId?: string;

  @Expose({ name: 'pthid' })
  @Matches(MessageIdRegExp)
  parentThreadId?: string;

  @Expose({ name: 'sender_order' })
  senderOrder?: number;

  @Expose({ name: 'received_orders' })
  receivedOrders?: { [key: string]: number };
}
