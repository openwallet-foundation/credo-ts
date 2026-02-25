import { IsEnum } from 'class-validator'

import { DidCommMessage } from '../../DidCommMessage'
import { IsValidMessageType, parseMessageType } from '../../util/messageType'

/**
 * Ack message status types
 */
export enum AckStatus {
  OK = 'OK',
  PENDING = 'PENDING',
}

export interface DidCommAckMessageOptions {
  id?: string
  threadId: string
  status: AckStatus
}

/**
 * @see https://github.com/hyperledger/aries-rfcs/blob/master/features/0015-acks/README.md#explicit-acks
 */
export class DidCommAckMessage extends DidCommMessage {
  /**
   * Create new AckMessage instance.
   * @param options
   */
  public constructor(options: DidCommAckMessageOptions) {
    super()

    if (options) {
      this.id = options.id || this.generateId()
      this.status = options.status

      this.setThread({
        threadId: options.threadId,
      })
    }
  }

  @IsValidMessageType(DidCommAckMessage.type)
  public readonly type: string = DidCommAckMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/notification/1.0/ack')

  @IsEnum(AckStatus)
  public status!: AckStatus
}
