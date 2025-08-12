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

export interface AckMessageOptions {
  id?: string
  threadId: string
  status: AckStatus
}

/**
 * @see https://github.com/hyperledger/aries-rfcs/blob/master/features/0015-acks/README.md#explicit-acks
 */
export class AckDidCommMessage extends DidCommMessage {
  /**
   * Create new AckMessage instance.
   * @param options
   */
  public constructor(options: AckMessageOptions) {
    super()

    if (options) {
      this.id = options.id || this.generateId()
      this.status = options.status

      this.setThread({
        threadId: options.threadId,
      })
    }
  }

  @IsValidMessageType(AckDidCommMessage.type)
  public readonly type: string = AckDidCommMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/notification/1.0/ack')

  @IsEnum(AckStatus)
  public status!: AckStatus
}
