import type { DIDCommV2MessageParams } from '../../../../../../agent/didcomm'
import type { Attachment } from 'didcomm'

import { Type, Expose } from 'class-transformer'
import { ValidateNested, IsObject, IsOptional, IsString } from 'class-validator'

import { DIDCommV2Message } from '../../../../../../agent/didcomm'
import { IsValidMessageType, parseMessageType } from '../../../../../../utils/messageType'

export type DeliveryMessageParams = {
  body: DeliveryBody
  attachments: Attachment[]
} & DIDCommV2MessageParams

class DeliveryBody {
  @IsString()
  @IsOptional()
  @Expose({ name: 'recipient_key' })
  public recipientKey?: string
}

export class DeliveryMessage extends DIDCommV2Message {
  @IsObject()
  @ValidateNested()
  @Type(() => DeliveryBody)
  public body!: DeliveryBody

  @IsValidMessageType(DeliveryMessage.type)
  public readonly type = DeliveryMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/messagepickup/3.0/delivery')

  public attachments!: Array<Attachment>

  public constructor(params?: DeliveryMessageParams) {
    super(params)
    if (params) {
      this.body = params.body
      this.attachments = params.attachments
      this.thid = params.thid
    }
  }
}
