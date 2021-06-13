import type { WireMessage } from '../../../types'

import { Type, Expose } from 'class-transformer'
import { Equals, Matches, IsArray, ValidateNested } from 'class-validator'

import { AgentMessage } from '../../../agent/AgentMessage'
import { MessageIdRegExp } from '../../../agent/BaseMessage'
import { uuid } from '../../../utils/uuid'

import { RoutingMessageType as MessageType } from './RoutingMessageType'

export interface BatchMessageOptions {
  id?: string
  messages: BatchMessageMessage[]
}

/**
 * A message that contains multiple waiting messages.
 *
 * @see https://github.com/hyperledger/aries-rfcs/blob/master/features/0212-pickup/README.md#batch
 */
export class BatchMessage extends AgentMessage {
  public constructor(options: BatchMessageOptions) {
    super()

    if (options) {
      this.id = options.id || this.generateId()
      this.messages = options.messages
    }
  }

  @Equals(BatchMessage.type)
  public readonly type = BatchMessage.type
  public static readonly type = MessageType.Batch

  @Type(() => BatchMessageMessage)
  @IsArray()
  @ValidateNested()
  // TODO: Update to attachment decorator
  // However i think the usage of the attachment decorator
  // as specified in the Pickup Protocol is incorrect
  @Expose({ name: 'messages~attach' })
  public messages!: BatchMessageMessage[]
}

export class BatchMessageMessage {
  public constructor(options: { id?: string; message: WireMessage }) {
    if (options) {
      this.id = options.id || uuid()
      this.message = options.message
    }
  }

  @Matches(MessageIdRegExp)
  public id!: string

  public message!: WireMessage
}
