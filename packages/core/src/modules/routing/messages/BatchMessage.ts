import type { DIDCommV2MessageParams } from '../../../agent/didcomm'

import { Type, Expose } from 'class-transformer'
import { Equals, Matches, IsArray, ValidateNested, IsObject, IsInstance } from 'class-validator'

import { DIDCommV1Message, DIDCommV2Message } from '../../../agent/didcomm'
import { EncryptedMessage } from '../../../agent/didcomm/types'
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
    super(options)

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

export class BatchMessageV2Body {
  @Type(() => BatchMessageMessage)
  @IsArray()
  @ValidateNested()
  @IsInstance(BatchMessageMessage, { each: true })
  public messages!: BatchMessageMessage[]
}

export type BatchMessageV2Options = {
  body: BatchMessageV2Body
} & DIDCommV2MessageParams

/**
 * A message that contains multiple waiting messages.
 * DIDComm V2 version of message defined here https://github.com/hyperledger/aries-rfcs/blob/master/features/0212-pickup/README.md#batch
 */
export class BatchMessageV2 extends DIDCommV2Message {
  public constructor(options: BatchMessageV2Options) {
    super(options)

    if (options) {
      this.body = options.body
    }
  }

  @Equals(BatchMessageV2.type)
  public readonly type = BatchMessageV2.type
  public static readonly type = 'https://didcomm.org/messagepickup/2.0/batch'

  @Type(() => BatchMessageV2Body)
  @ValidateNested()
  public body!: BatchMessageV2Body
}
