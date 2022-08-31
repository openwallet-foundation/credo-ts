import { Type, Expose } from 'class-transformer'
import { Matches, IsArray, ValidateNested, IsObject, IsInstance } from 'class-validator'

import { AgentMessage } from '../../../../../../agent/AgentMessage'
import { MessageIdRegExp } from '../../../../../../agent/BaseMessage'
import { EncryptedMessage } from '../../../../../../types'
import { IsValidMessageType, parseMessageType } from '../../../../../../utils/messageType'
import { uuid } from '../../../../../../utils/uuid'

export class BatchMessageMessage {
  public constructor(options: { id?: string; message: EncryptedMessage }) {
    if (options) {
      this.id = options.id || uuid()
      this.message = options.message
    }
  }

  @Matches(MessageIdRegExp)
  public id!: string

  @IsObject()
  public message!: EncryptedMessage
}

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

  @IsValidMessageType(BatchMessage.type)
  public readonly type = BatchMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/messagepickup/1.0/batch')

  @Type(() => BatchMessageMessage)
  @IsArray()
  @ValidateNested()
  @IsInstance(BatchMessageMessage, { each: true })
  @Expose({ name: 'messages~attach' })
  public messages!: BatchMessageMessage[]
}
