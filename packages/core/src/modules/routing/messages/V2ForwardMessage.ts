import type { DidCommV2MessageParams } from '../../../didcomm'

import { Type } from 'class-transformer'
import { IsString, ValidateNested } from 'class-validator'

import { DidCommV2Message } from '../../../didcomm'
import { IsValidMessageType, parseMessageType } from '../../../utils/messageType'

export class V2ForwardMessageBody {
  @IsString()
  public next!: string
}

export type V2ForwardMessageOptions = {
  body: V2ForwardMessageBody
} & DidCommV2MessageParams

/**
 * DIDComm V2 version of message defined here https://identity.foundation/didcomm-messaging/spec/#messages
 */
export class V2ForwardMessage extends DidCommV2Message {
  /**
   * Create new ForwardMessage instance.
   *
   * @param options
   */
  public constructor(options: V2ForwardMessageOptions) {
    super(options)

    if (options) {
      this.body = options.body
    }
  }

  @IsValidMessageType(V2ForwardMessage.type)
  public readonly type = V2ForwardMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/routing/2.0/forward')

  @Type(() => V2ForwardMessageBody)
  @ValidateNested()
  public body!: V2ForwardMessageBody
}
