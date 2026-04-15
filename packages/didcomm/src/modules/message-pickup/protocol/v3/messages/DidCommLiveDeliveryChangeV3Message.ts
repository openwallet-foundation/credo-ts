import { Expose } from 'class-transformer'
import { IsBoolean } from 'class-validator'

import { DidCommMessage } from '../../../../../DidCommMessage'
import { ReturnRouteTypes } from '../../../../../decorators/transport/TransportDecorator'
import { IsValidMessageType, parseMessageType } from '../../../../../util/messageType'
import type { DidCommVersion } from '../../../../../util/didcommVersion'

export interface DidCommLiveDeliveryChangeV3MessageOptions {
  id?: string
  liveDelivery: boolean
}

export class DidCommLiveDeliveryChangeV3Message extends DidCommMessage {
  public readonly allowQueueTransport = false
  public readonly supportedDidCommVersions: DidCommVersion[] = ['v2']

  public constructor(options: DidCommLiveDeliveryChangeV3MessageOptions) {
    super()

    if (options) {
      this.id = options.id ?? this.generateId()
      this.liveDelivery = options.liveDelivery
    }
    this.setReturnRouting(ReturnRouteTypes.all)
  }

  @IsValidMessageType(DidCommLiveDeliveryChangeV3Message.type)
  public readonly type = DidCommLiveDeliveryChangeV3Message.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/messagepickup/3.0/live-delivery-change')

  @IsBoolean()
  @Expose({ name: 'live_delivery' })
  public liveDelivery!: boolean
}
