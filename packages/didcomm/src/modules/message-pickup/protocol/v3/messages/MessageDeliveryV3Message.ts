import { Expose } from 'class-transformer'
import { IsOptional, IsString } from 'class-validator'

import { DidCommMessage } from '../../../../../DidCommMessage'
import type { DidCommAttachment } from '../../../../../decorators/attachment/DidCommAttachment'
import { ReturnRouteTypes } from '../../../../../decorators/transport/TransportDecorator'
import { IsValidMessageType, parseMessageType } from '../../../../../util/messageType'

export interface MessageDeliveryV3MessageOptions {
  id?: string
  recipientDid?: string
  threadId?: string
  attachments: DidCommAttachment[]
}

export class MessageDeliveryV3Message extends DidCommMessage {
  public readonly allowQueueTransport = false
  public readonly supportedDidCommVersions: ('v1' | 'v2')[] = ['v2']

  public constructor(options: MessageDeliveryV3MessageOptions) {
    super()

    if (options) {
      this.id = options.id ?? this.generateId()
      this.recipientDid = options.recipientDid
      this.appendedAttachments = options.attachments
      if (options.threadId) {
        this.setThread({
          threadId: options.threadId,
        })
      }
    }
    this.setReturnRouting(ReturnRouteTypes.all)
  }

  @IsValidMessageType(MessageDeliveryV3Message.type)
  public readonly type = MessageDeliveryV3Message.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/messagepickup/3.0/delivery')

  @IsString()
  @IsOptional()
  @Expose({ name: 'recipient_did' })
  public recipientDid?: string
}
