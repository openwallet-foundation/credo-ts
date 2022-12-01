import type { DIDCommV2MessageParams } from '../../../../../../agent/didcomm'

import { Expose, Type } from 'class-transformer'
import { IsNotEmpty, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator'

import { DIDCommV2Message } from '../../../../../../agent/didcomm'
import { IsValidMessageType, parseMessageType } from '../../../../../../utils/messageType'

export type StatusRequestMessageParams = {
  body: StatusRequestBody
} & DIDCommV2MessageParams

class StatusRequestBody {
  @IsString()
  @IsOptional()
  @Expose({ name: 'recipient_key' })
  public recipientKey?: string
}

export class StatusRequestMessage extends DIDCommV2Message {
  @IsString()
  @IsNotEmpty()
  public from!: string

  @IsObject()
  @ValidateNested()
  @Type(() => StatusRequestBody)
  public body!: StatusRequestBody

  @IsValidMessageType(StatusRequestMessage.type)
  public readonly type = StatusRequestMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/messagepickup/3.0/status-request')

  public constructor(params?: StatusRequestMessageParams) {
    super(params)
    if (params) {
      this.body = params.body
    }
  }
}
