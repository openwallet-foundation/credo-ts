import { Expose } from 'class-transformer'
import { IsOptional, IsString } from 'class-validator'

import { DidCommV1Message } from '../../../../../../didcomm'
import { IsValidMessageType, parseMessageType } from '../../../../../../utils/messageType'

export interface StatusRequestMessageOptions {
  id?: string
  recipientKey?: string
}

export class StatusRequestMessage extends DidCommV1Message {
  public constructor(options: StatusRequestMessageOptions) {
    super()

    if (options) {
      this.id = options.id || this.generateId()
      this.recipientKey = options.recipientKey
    }
  }

  @IsValidMessageType(StatusRequestMessage.type)
  public readonly type = StatusRequestMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/messagepickup/2.0/status-request')

  @IsString()
  @IsOptional()
  @Expose({ name: 'recipient_key' })
  public recipientKey?: string
}
