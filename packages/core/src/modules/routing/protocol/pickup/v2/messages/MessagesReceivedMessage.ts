import { Expose } from 'class-transformer'
import { IsArray, IsOptional } from 'class-validator'

import { AgentMessage } from '../../../../../../agent/AgentMessage'
import { ReturnRouteTypes } from '../../../../../../decorators/transport/TransportDecorator'
import { IsValidMessageType, parseMessageType } from '../../../../../../utils/messageType'

export interface MessagesReceivedMessageOptions {
  id?: string
  messageIdList: string[]
}

export class MessagesReceivedMessage extends AgentMessage {
  public constructor(options: MessagesReceivedMessageOptions) {
    super()

    if (options) {
      this.id = options.id || this.generateId()
      this.messageIdList = options.messageIdList
    }
    this.setReturnRouting(ReturnRouteTypes.all)
  }

  @IsValidMessageType(MessagesReceivedMessage.type)
  public readonly type = MessagesReceivedMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/messagepickup/2.0/messages-received')

  @IsArray()
  @IsOptional()
  @Expose({ name: 'message_id_list' })
  public messageIdList?: string[]
}
