import { Expose } from 'class-transformer'
import { IsInt, IsOptional, IsString } from 'class-validator'

import { DidCommMessage } from '../../../../../DidCommMessage'
import { ReturnRouteTypes } from '../../../../../decorators/transport/TransportDecorator'
import { IsValidMessageType, parseMessageType } from '../../../../../util/messageType'
import type { DidCommVersion } from '../../../../../util/didcommVersion'

export interface DeliveryRequestV3MessageOptions {
  id?: string
  recipientDid?: string
  limit: number
}

export class DeliveryRequestV3Message extends DidCommMessage {
  public readonly allowQueueTransport = false
  public readonly supportedDidCommVersions: DidCommVersion[] = ['v2']

  public constructor(options: DeliveryRequestV3MessageOptions) {
    super()

    if (options) {
      this.id = options.id ?? this.generateId()
      this.recipientDid = options.recipientDid
      this.limit = options.limit
    }
    this.setReturnRouting(ReturnRouteTypes.all)
  }

  @IsValidMessageType(DeliveryRequestV3Message.type)
  public readonly type = DeliveryRequestV3Message.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/messagepickup/3.0/delivery-request')

  @IsString()
  @IsOptional()
  @Expose({ name: 'recipient_did' })
  public recipientDid?: string

  @IsInt()
  public limit!: number
}
