import { Expose } from 'class-transformer'
import { IsInt, IsOptional, Matches } from 'class-validator'

// ^did:[a-z0-9]+:(?:%[0-9A-Fa-f]{2}|[A-Za-z0-9.-])+  # domain (no ':', allows %XX)
// (?::(?:%[0-9A-Fa-f]{2}|[A-Za-z0-9._~!$&'()*+,;=:@/?-])*)*  # extra colon-separated segments
// (?:\?(?:%[0-9A-Fa-f]{2}|[A-Za-z0-9._~!$&'()*+,;=:@/?-])*)?  # optional query
// (?:#(?:%[0-9A-Fa-f]{2}|[A-Za-z0-9._~!$&'()*+,;=:@/?-])*)?   # optional fragment
// $

const PthidRegExp =
  /^([-_./A-Za-z0-9]{8,64}|did:[a-z0-9]+:(?:%[0-9A-Fa-f]{2}|[A-Za-z0-9.-])+(?::(?:%[0-9A-Fa-f]{2}|[A-Za-z0-9._~!$&'()*+,;=:@/?-])*)*(?:\?(?:%[0-9A-Fa-f]{2}|[A-Za-z0-9._~!$&'()*+,;=:@/?-])*)?(?:#(?:%[0-9A-Fa-f]{2}|[A-Za-z0-9._~!$&'()*+,;=:@/?-])*)?)$/

/**
 * Represents `~thread` decorator
 * @see https://github.com/hyperledger/aries-rfcs/blob/master/concepts/0008-message-id-and-threading/README.md
 */

export class ThreadDecorator {
  public constructor(partial?: Partial<ThreadDecorator>) {
    this.threadId = partial?.threadId
    this.parentThreadId = partial?.parentThreadId
    this.senderOrder = partial?.senderOrder
    this.receivedOrders = partial?.receivedOrders
  }

  /**
   * The ID of the message that serves as the thread start.
   */
  @Expose({ name: 'thid' })
  @Matches(PthidRegExp)
  @IsOptional()
  public threadId?: string

  /**
   * An optional parent `thid`. Used when branching or nesting a new interaction off of an existing one.
   */
  @Expose({ name: 'pthid' })
  @Matches(PthidRegExp)
  @IsOptional()
  public parentThreadId?: string

  /**
   * A number that tells where this message fits in the sequence of all messages that the current sender has contributed to this thread.
   */
  @Expose({ name: 'sender_order' })
  @IsOptional()
  @IsInt()
  public senderOrder?: number

  /**
   * Reports the highest `sender_order` value that the sender has seen from other sender(s) on the thread.
   * This value is often missing if it is the first message in an interaction, but should be used otherwise, as it provides an implicit ACK.
   */
  @Expose({ name: 'received_orders' })
  @IsOptional()
  public receivedOrders?: { [key: string]: number }
}
