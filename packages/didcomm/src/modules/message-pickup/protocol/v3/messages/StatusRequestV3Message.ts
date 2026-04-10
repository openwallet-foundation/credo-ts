import { Expose } from 'class-transformer'
import { IsOptional, IsString } from 'class-validator'

import { DidCommMessage } from '../../../../../DidCommMessage'
import { ReturnRouteTypes } from '../../../../../decorators/transport/TransportDecorator'
import { IsValidMessageType, parseMessageType } from '../../../../../util/messageType'

export interface StatusRequestV3MessageOptions {
  id?: string
  recipientDid?: string
}

export class StatusRequestV3Message extends DidCommMessage {
  public readonly allowQueueTransport = false
  public readonly supportedDidCommVersions: ('v1' | 'v2')[] = ['v2']

  public constructor(options?: StatusRequestV3MessageOptions) {
    super()

    if (options) {
      this.id = options.id ?? this.generateId()
      this.recipientDid = options.recipientDid
    }
    this.setReturnRouting(ReturnRouteTypes.all)
  }

  @IsValidMessageType(StatusRequestV3Message.type)
  public readonly type = StatusRequestV3Message.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/messagepickup/3.0/status-request')

  @IsString()
  @IsOptional()
  @Expose({ name: 'recipient_did' })
  public recipientDid?: string
}
