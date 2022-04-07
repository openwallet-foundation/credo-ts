import type { Attachment } from '../../../decorators/attachment/Attachment'

import { Expose } from 'class-transformer'
import { Equals, IsOptional, IsString } from 'class-validator'
import { Verkey } from 'indy-sdk'

import { AgentMessage } from '../../../agent/AgentMessage'

export interface MessageDeliveryMessageOptions {
  id?: string
  recipientKey?: string
  attachments: Attachment[]
}

export class MessageDeliveryMessage extends AgentMessage {
  public constructor(options: MessageDeliveryMessageOptions) {
    super()

    if (options) {
      this.id = options.id || this.generateId()
      this.recipientKey = options.recipientKey
      this.attachments = options.attachments
    }
  }

  @Equals(MessageDeliveryMessage.type)
  public readonly type = MessageDeliveryMessage.type
  public static readonly type = 'https://didcomm.org/messagepickup/2.0/delivery'

  @IsString()
  @IsOptional()
  @Expose({ name: 'recipient_key' })
  public recipientKey?: Verkey
}
