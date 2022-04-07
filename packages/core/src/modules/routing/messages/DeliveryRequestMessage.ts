import { Expose } from 'class-transformer'
import { Equals, IsInt, IsOptional, IsString } from 'class-validator'
import { Verkey } from 'indy-sdk'

import { AgentMessage } from '../../../agent/AgentMessage'

export interface DeliveryRequestMessageOptions {
  id?: string
  recipientKey?: string
  limit: number
}

export class DeliveryRequestMessage extends AgentMessage {
  public constructor(options: DeliveryRequestMessageOptions) {
    super()

    if (options) {
      this.id = options.id || this.generateId()
      this.recipientKey = options.recipientKey
      this.limit = options.limit
    }
  }

  @Equals(DeliveryRequestMessage.type)
  public readonly type = DeliveryRequestMessage.type
  public static readonly type = 'https://didcomm.org/messagepickup/2.0/delivery-request'

  @IsString()
  @IsOptional()
  @Expose({ name: 'recipient_key' })
  public recipientKey?: Verkey

  @IsInt()
  public limit!: number
}
