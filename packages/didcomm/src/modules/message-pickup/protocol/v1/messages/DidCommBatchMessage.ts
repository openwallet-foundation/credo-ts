import { utils } from '@credo-ts/core'
import { Expose, Type } from 'class-transformer'
import { IsArray, IsInstance, IsObject, Matches, ValidateNested } from 'class-validator'

import { MessageIdRegExp } from '../../../../../BaseDidCommMessage'
import { DidCommMessage } from '../../../../../DidCommMessage'
import { DidCommEncryptedMessage } from '../../../../../types'
import { IsValidMessageType, parseMessageType } from '../../../../../util/messageType'

export class DidCommBatchMessageMessage {
  public constructor(options: { id?: string; message: DidCommEncryptedMessage }) {
    if (options) {
      this.id = options.id || utils.uuid()
      this.message = options.message
    }
  }

  @Matches(MessageIdRegExp)
  public id!: string

  @IsObject()
  public message!: DidCommEncryptedMessage
}

export interface DidCommBatchMessageOptions {
  id?: string
  messages: DidCommBatchMessageMessage[]
  threadId?: string
}

/**
 * A message that contains multiple waiting messages.
 *
 * @see https://github.com/hyperledger/aries-rfcs/blob/master/features/0212-pickup/README.md#batch
 */
export class DidCommBatchMessage extends DidCommMessage {
  public readonly allowQueueTransport = false

  public constructor(options: DidCommBatchMessageOptions) {
    super()

    if (options) {
      this.id = options.id || this.generateId()
      this.messages = options.messages

      if (options.threadId) {
        this.setThread({
          threadId: options.threadId,
        })
      }
    }
  }

  @IsValidMessageType(DidCommBatchMessage.type)
  public readonly type = DidCommBatchMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/messagepickup/1.0/batch')

  @Type(() => DidCommBatchMessageMessage)
  @IsArray()
  @ValidateNested()
  @IsInstance(DidCommBatchMessageMessage, { each: true })
  @Expose({ name: 'messages~attach' })
  public messages!: DidCommBatchMessageMessage[]
}
