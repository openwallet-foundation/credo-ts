import type { DidCommV2MessageParams } from '../../../../../../didcomm'

import { Type, Expose } from 'class-transformer'
import { ValidateNested, IsObject, IsArray, ArrayNotEmpty } from 'class-validator'

import { DidCommV2Message } from '../../../../../../didcomm'
import { IsValidMessageType, parseMessageType } from '../../../../../../utils/messageType'

export type MessagesReceivedMessageParams = {
  body: MessagesReceivedBody
} & DidCommV2MessageParams

class MessagesReceivedBody {
  @IsArray()
  @ArrayNotEmpty()
  @Expose({ name: 'message_id_list' })
  public messageIdList!: string[]
}

/**
 * A message that contains ids of read messages.
 *
 * @see https://github.com/decentralized-identity/didcomm.org/tree/main/site/content/protocols/pickup/3.0#messages-received
 */
export class MessagesReceivedMessage extends DidCommV2Message {
  @IsObject()
  @ValidateNested()
  @Type(() => MessagesReceivedBody)
  public body!: MessagesReceivedBody

  @IsValidMessageType(MessagesReceivedMessage.type)
  public readonly type = MessagesReceivedMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/messagepickup/3.0/messages-received')

  public constructor(params?: MessagesReceivedMessageParams) {
    super(params)
    if (params) {
      this.body = params.body
    }
  }
}
