import { Expose } from 'class-transformer'
import { IsOptional, IsString } from 'class-validator'
import { DidCommMessage } from '../../../../../DidCommMessage'
import type { DidCommAttachment } from '../../../../../decorators/attachment/DidCommAttachment'
import { ReturnRouteTypes } from '../../../../../decorators/transport/TransportDecorator'
import { IsValidMessageType, parseMessageType } from '../../../../../util/messageType'

export interface DidCommMessageDeliveryV2MessageOptions {
  id?: string
  recipientKey?: string
  threadId?: string
  attachments: DidCommAttachment[]
}

export class DidCommMessageDeliveryV2Message extends DidCommMessage {
  public readonly allowQueueTransport = false

  public constructor(options: DidCommMessageDeliveryV2MessageOptions) {
    super()

    if (options) {
      this.id = options.id || this.generateId()
      this.recipientKey = options.recipientKey
      this.appendedAttachments = options.attachments
      if (this.threadId) {
        this.setThread({
          threadId: options.threadId,
        })
      }
    }
    this.setReturnRouting(ReturnRouteTypes.all)
  }

  @IsValidMessageType(DidCommMessageDeliveryV2Message.type)
  public readonly type = DidCommMessageDeliveryV2Message.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/messagepickup/2.0/delivery')

  @IsString()
  @IsOptional()
  @Expose({ name: 'recipient_key' })
  public recipientKey?: string
}
