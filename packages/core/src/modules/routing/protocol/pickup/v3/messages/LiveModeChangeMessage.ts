import type { DIDCommV2MessageParams } from '../../../../../../agent/didcomm'

import { Expose, Type } from 'class-transformer'
import { IsBoolean, IsNotEmpty, IsObject, IsString, ValidateNested } from 'class-validator'

import { DIDCommV2Message } from '../../../../../../agent/didcomm'
import { IsValidMessageType, parseMessageType } from '../../../../../../utils/messageType'

export type LiveModeChangeMessageParams = {
  body: LiveModeChangeBody
} & DIDCommV2MessageParams

class LiveModeChangeBody {
  @IsBoolean()
  @Expose({ name: 'live_delivery' })
  public liveDelivery!: boolean
}

export class LiveModeChangeMessage extends DIDCommV2Message {
  @IsString()
  @IsNotEmpty()
  public from!: string

  @IsObject()
  @ValidateNested()
  @Type(() => LiveModeChangeBody)
  public body!: LiveModeChangeBody

  @IsValidMessageType(LiveModeChangeMessage.type)
  public readonly type = LiveModeChangeMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/messagepickup/3.0/live-delivery-change')

  public constructor(params?: LiveModeChangeMessageParams) {
    super(params)
    if (params) {
      this.body = params.body
    }
  }
}
