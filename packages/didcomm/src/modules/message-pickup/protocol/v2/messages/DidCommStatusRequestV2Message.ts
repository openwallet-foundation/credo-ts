import { Expose } from 'class-transformer'
import { IsOptional, IsString } from 'class-validator'

import { DidCommMessage } from '../../../../../DidCommMessage'
import { IsValidMessageType, parseMessageType } from '../../../../../util/messageType'

export interface DidCommStatusRequestMessageV2MessageOptions {
  id?: string
  recipientKey?: string
}

export class DidCommStatusRequestV2Message extends DidCommMessage {
  public readonly allowQueueTransport = false

  public constructor(options: DidCommStatusRequestMessageV2MessageOptions) {
    super()

    if (options) {
      this.id = options.id || this.generateId()
      this.recipientKey = options.recipientKey
    }
  }

  @IsValidMessageType(DidCommStatusRequestV2Message.type)
  public readonly type = DidCommStatusRequestV2Message.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/messagepickup/2.0/status-request')

  @IsString()
  @IsOptional()
  @Expose({ name: 'recipient_key' })
  public recipientKey?: string
}
