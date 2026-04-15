import { Expose } from 'class-transformer'
import { IsOptional, IsString } from 'class-validator'

import { DidCommMessage } from '../../../../../DidCommMessage'
import type { DidCommAttachment } from '../../../../../decorators/attachment/DidCommAttachment'
import { ReturnRouteTypes } from '../../../../../decorators/transport/TransportDecorator'
import { IsValidMessageType, parseMessageType } from '../../../../../util/messageType'
import type { DidCommVersion } from '../../../../../util/didcommVersion'

export interface DidCommMessageDeliveryV3MessageOptions {
  id?: string
  recipientDid?: string
  threadId?: string
  attachments: DidCommAttachment[]
}

export class DidCommMessageDeliveryV3Message extends DidCommMessage {
  public readonly allowQueueTransport = false
  public readonly supportedDidCommVersions: DidCommVersion[] = ['v2']

  public constructor(options: DidCommMessageDeliveryV3MessageOptions) {
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

  @IsValidMessageType(DidCommMessageDeliveryV3Message.type)
  public readonly type = DidCommMessageDeliveryV3Message.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/messagepickup/3.0/delivery')

  @IsString()
  @IsOptional()
  @Expose({ name: 'recipient_did' })
  public recipientDid?: string
}
