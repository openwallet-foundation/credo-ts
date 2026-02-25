import { Expose } from 'class-transformer'
import { IsArray } from 'class-validator'

import { DidCommMessage } from '../../../../../DidCommMessage'
import { ReturnRouteTypes } from '../../../../../decorators/transport/TransportDecorator'
import { IsValidMessageType, parseMessageType } from '../../../../../util/messageType'

export interface DidCommMessagesReceivedV2MessageOptions {
  id?: string
  messageIdList: string[]
}

export class DidCommMessagesReceivedV2Message extends DidCommMessage {
  public readonly allowQueueTransport = false

  public constructor(options: DidCommMessagesReceivedV2MessageOptions) {
    super()

    if (options) {
      this.id = options.id || this.generateId()
      this.messageIdList = options.messageIdList
    }
    this.setReturnRouting(ReturnRouteTypes.all)
  }

  @IsValidMessageType(DidCommMessagesReceivedV2Message.type)
  public readonly type = DidCommMessagesReceivedV2Message.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/messagepickup/2.0/messages-received')

  @IsArray()
  @Expose({ name: 'message_id_list' })
  public messageIdList!: string[]
}
