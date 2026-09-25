import { Expose } from 'class-transformer'
import { IsInt, IsOptional, IsString } from 'class-validator'

import { DidCommMessage } from '../../../../../DidCommMessage'
import { ReturnRouteTypes } from '../../../../../decorators/transport/TransportDecorator'
import type { DidCommVersion } from '../../../../../util/didcommVersion'
import { IsValidMessageType, parseMessageType } from '../../../../../util/messageType'

export interface DidCommDeliveryRequestV4MessageOptions {
  id?: string
  recipientDid?: string
  messageCountLimit: number
}

export class DidCommDeliveryRequestV4Message extends DidCommMessage {
  public readonly allowQueueTransport = false
  public readonly supportedDidCommVersions: DidCommVersion[] = ['v2']

  public constructor(options: DidCommDeliveryRequestV4MessageOptions) {
    super()

    if (options) {
      this.id = options.id ?? this.generateId()
      this.recipientDid = options.recipientDid
      this.messageCountLimit = options.messageCountLimit
    }
    this.setReturnRouting(ReturnRouteTypes.all)
  }

  @IsValidMessageType(DidCommDeliveryRequestV4Message.type)
  public readonly type = DidCommDeliveryRequestV4Message.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/message-pickup/4.0/delivery-request')

  @IsString()
  @IsOptional()
  @Expose({ name: 'recipient_did' })
  public recipientDid?: string

  @IsInt()
  @Expose({ name: 'message_count_limit' })
  public messageCountLimit!: number
}
