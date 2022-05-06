import { Expose } from 'class-transformer'
import { Equals, IsOptional, IsString } from 'class-validator'

import { AgentMessage } from '../../../agent/AgentMessage'

export interface StatusRequestMessageOptions {
  id?: string
  recipientKey?: string
}

export class StatusRequestMessage extends AgentMessage {
  public constructor(options: StatusRequestMessageOptions) {
    super()

    if (options) {
      this.id = options.id || this.generateId()
      this.recipientKey = options.recipientKey
    }
  }

  @Equals(StatusRequestMessage.type)
  public readonly type = StatusRequestMessage.type
  public static readonly type = 'https://didcomm.org/messagepickup/2.0/status-request'

  @IsString()
  @IsOptional()
  @Expose({ name: 'recipient_key' })
  public recipientKey?: string
}
