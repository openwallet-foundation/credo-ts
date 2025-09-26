import { Expose } from 'class-transformer'
import { IsInt, IsOptional, IsString } from 'class-validator'

import { DidCommMessage } from '../../../../../DidCommMessage'
import { ReturnRouteTypes } from '../../../../../decorators/transport/TransportDecorator'
import { IsValidMessageType, parseMessageType } from '../../../../../util/messageType'

export interface DidCommDeliveryRequestV2MessageOptions {
  id?: string
  recipientKey?: string
  limit: number
}

export class DidCommDeliveryRequestV2Message extends DidCommMessage {
  public readonly allowQueueTransport = false

  public constructor(options: DidCommDeliveryRequestV2MessageOptions) {
    super()

    if (options) {
      this.id = options.id || this.generateId()
      this.recipientKey = options.recipientKey
      this.limit = options.limit
    }
    this.setReturnRouting(ReturnRouteTypes.all)
  }

  @IsValidMessageType(DidCommDeliveryRequestV2Message.type)
  public readonly type = DidCommDeliveryRequestV2Message.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/messagepickup/2.0/delivery-request')

  @IsString()
  @IsOptional()
  @Expose({ name: 'recipient_key' })
  public recipientKey?: string

  @IsInt()
  public limit!: number
}
