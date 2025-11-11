import { Expose } from 'class-transformer'
import { IsBoolean } from 'class-validator'

import { DidCommMessage } from '../../../../../DidCommMessage'
import { ReturnRouteTypes } from '../../../../../decorators/transport/TransportDecorator'
import { IsValidMessageType, parseMessageType } from '../../../../../util/messageType'

export interface DidCommLiveDeliveryChangeV2MessageOptions {
  id?: string
  liveDelivery: boolean
}

export class DidCommLiveDeliveryChangeV2Message extends DidCommMessage {
  public readonly allowQueueTransport = false

  public constructor(options: DidCommLiveDeliveryChangeV2MessageOptions) {
    super()

    if (options) {
      this.id = options.id || this.generateId()
      this.liveDelivery = options.liveDelivery
    }
    this.setReturnRouting(ReturnRouteTypes.all)
  }

  @IsValidMessageType(DidCommLiveDeliveryChangeV2Message.type)
  public readonly type = DidCommLiveDeliveryChangeV2Message.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/messagepickup/2.0/live-delivery-change')

  @IsBoolean()
  @Expose({ name: 'live_delivery' })
  public liveDelivery!: boolean
}
