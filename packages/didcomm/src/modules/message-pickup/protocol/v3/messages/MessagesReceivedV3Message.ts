import { Expose } from 'class-transformer'
import { IsArray } from 'class-validator'

import { DidCommMessage } from '../../../../../DidCommMessage'
import { ReturnRouteTypes } from '../../../../../decorators/transport/TransportDecorator'
import { IsValidMessageType, parseMessageType } from '../../../../../util/messageType'

export interface MessagesReceivedV3MessageOptions {
  id?: string
  messageIdList: string[]
}

export class MessagesReceivedV3Message extends DidCommMessage {
  public readonly allowQueueTransport = false
  public readonly supportedDidCommVersions: ('v1' | 'v2')[] = ['v2']

  public constructor(options: MessagesReceivedV3MessageOptions) {
    super()

    if (options) {
      this.id = options.id ?? this.generateId()
      this.messageIdList = options.messageIdList
    }
    this.setReturnRouting(ReturnRouteTypes.all)
  }

  @IsValidMessageType(MessagesReceivedV3Message.type)
  public readonly type = MessagesReceivedV3Message.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/messagepickup/3.0/messages-received')

  @IsArray()
  @Expose({ name: 'message_id_list' })
  public messageIdList!: string[]
}
