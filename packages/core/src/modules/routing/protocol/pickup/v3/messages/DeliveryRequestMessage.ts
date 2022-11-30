import type { DIDCommV2MessageParams } from '../../../../../../agent/didcomm'

import { Expose, Type } from 'class-transformer'
import { IsNotEmpty, IsNumber, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator'

import { DIDCommV2Message } from '../../../../../../agent/didcomm'
import { IsValidMessageType, parseMessageType } from '../../../../../../utils/messageType'

export type DeliveryRequestMessageV3Params = {
  body: DeliveryRequestBody
} & DIDCommV2MessageParams

class DeliveryRequestBody {
  @IsNumber()
  public limit!: number

  @IsString()
  @IsOptional()
  @Expose({ name: 'recipient_key' })
  public recipientKey?: string
}

export class DeliveryRequestMessage extends DIDCommV2Message {
  @IsString()
  @IsNotEmpty()
  public from!: string

  @IsObject()
  @ValidateNested()
  @Type(() => DeliveryRequestBody)
  public body!: DeliveryRequestBody

  @IsValidMessageType(DeliveryRequestMessage.type)
  public readonly type = DeliveryRequestMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/messagepickup/3.0/delivery-request')

  public constructor(params?: DeliveryRequestMessageV3Params) {
    super(params)
    if (params) {
      this.body = params.body
    }
  }
}
