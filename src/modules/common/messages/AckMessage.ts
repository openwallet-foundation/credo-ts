import { Equals, IsEnum } from 'class-validator'

import { AgentMessage } from '../../../agent/AgentMessage'
import { CommonMessageType } from './CommonMessageType'

/**
 * Ack message status types
 */
export enum AckStatus {
  OK = 'OK',
  FAIL = 'FAIL',
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
export class AckMessage extends AgentMessage {
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

  @Equals(AckMessage.type)
  public readonly type: string = AckMessage.type
  public static readonly type: string = CommonMessageType.Ack

  @IsEnum(AckStatus)
  public status!: AckStatus
}
