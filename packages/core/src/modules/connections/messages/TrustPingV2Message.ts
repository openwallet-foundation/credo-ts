import type { DIDCommV2MessageParams } from '../../../agent/didcomm'

import { Expose, Type } from 'class-transformer'
import { IsString, IsBoolean, IsNotEmpty, ValidateNested, IsObject } from 'class-validator'

import { DIDCommV2Message } from '../../../agent/didcomm'
import { IsValidMessageType, parseMessageType } from '../../../utils/messageType'

export type TrustPingMessageV2Options = {
  body: TrustPingBody
} & DIDCommV2MessageParams

class TrustPingBody {
  @IsBoolean()
  @Expose({ name: 'response_requested' })
  public responseRequested = true
}

export class TrustPingMessageV2 extends DIDCommV2Message {
  @IsString()
  @IsNotEmpty()
  public from!: string

  @IsObject()
  @ValidateNested()
  @Type(() => TrustPingBody)
  public body!: TrustPingBody

  @IsValidMessageType(TrustPingMessageV2.type)
  public readonly type = TrustPingMessageV2.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/trust-ping/2.0/ping')

  public constructor(options: TrustPingMessageV2Options) {
    super(options)

    if (options) {
      this.body = options.body
    }
  }
}
