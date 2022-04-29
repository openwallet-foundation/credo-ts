import { Type, Expose } from 'class-transformer'
import { Equals, Matches, IsArray, ValidateNested, IsObject, IsInstance } from 'class-validator'

import { EncryptedMessage } from '../../../agent/didcomm/types'
import { DIDCommV1Message } from '../../../agent/didcomm/v1/DIDCommV1Message'
import { MessageIdRegExp } from '../../../agent/didcomm/validation'
import { uuid } from '../../../utils/uuid'

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
export class BatchMessage extends DIDCommV1Message {
  public constructor(options: BatchMessageOptions) {
    super()

    if (options) {
      this.id = options.id || this.generateId()
      this.messages = options.messages
    }
  }

  @Equals(BatchMessage.type)
  public readonly type = BatchMessage.type
  public static readonly type = 'https://didcomm.org/messagepickup/1.0/batch'

  @Type(() => BatchMessageMessage)
  @IsArray()
  @ValidateNested()
  @IsInstance(BatchMessageMessage, { each: true })
  @Expose({ name: 'messages~attach' })
  public messages!: BatchMessageMessage[]
}
