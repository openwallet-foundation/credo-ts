import { Expose } from 'class-transformer'
import { IsArray } from 'class-validator'

import { DidCommMessage } from '../../../../../DidCommMessage'
import type { DidCommVersion } from '../../../../../util/didcommVersion'
import { IsValidMessageType, parseMessageType } from '../../../../../util/messageType'

export interface DidCommMessagesReceivedV4MessageOptions {
  id?: string
  messageIdList: string[]
}

export class DidCommMessagesReceivedV4Message extends DidCommMessage {
  public readonly allowQueueTransport = false
  public readonly supportedDidCommVersions: DidCommVersion[] = ['v2']

  public constructor(options: DidCommMessagesReceivedV4MessageOptions) {
    super()

    if (options) {
      this.id = options.id ?? this.generateId()
      this.messageIdList = options.messageIdList
    }
  }

  @IsValidMessageType(DidCommMessagesReceivedV4Message.type)
  public readonly type = DidCommMessagesReceivedV4Message.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/message-pickup/4.0/messages-received')

  @IsArray()
  @Expose({ name: 'message_id_list' })
  public messageIdList!: string[]
}
