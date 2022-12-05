import type { Attachment } from '../../../../../../decorators/attachment/v1/Attachment'

import { Expose } from 'class-transformer'
import { IsOptional, IsString } from 'class-validator'

import { ReturnRouteTypes } from '../../../../../../decorators/transport/TransportDecorator'
import { DidCommV1Message } from '../../../../../../didcomm'
import { IsValidMessageType, parseMessageType } from '../../../../../../utils/messageType'

export interface MessageDeliveryMessageOptions {
  id?: string
  recipientKey?: string
  threadId: string
  attachments: Attachment[]
}

export class MessageDeliveryMessage extends DidCommV1Message {
  public constructor(options: MessageDeliveryMessageOptions) {
    super()

    if (options) {
      this.id = options.id || this.generateId()
      this.recipientKey = options.recipientKey
      this.appendedAttachments = options.attachments
      this.setThread({
        threadId: options.threadId,
      })
    }
    this.setReturnRouting(ReturnRouteTypes.all)
  }

  @IsValidMessageType(MessageDeliveryMessage.type)
  public readonly type = MessageDeliveryMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/messagepickup/2.0/delivery')

  @IsString()
  @IsOptional()
  @Expose({ name: 'recipient_key' })
  public recipientKey?: string
}
