import type { DidCommV2MessageParams } from '../../../../../../didcomm/versions/v2'

import { Expose, Type } from 'class-transformer'
import { IsString, IsBoolean, IsNotEmpty, ValidateNested, IsObject } from 'class-validator'

import { DidCommV2Message } from '../../../../../../didcomm'
import { IsValidMessageType, parseMessageType } from '../../../../../../utils/messageType'

export type TrustPingMessageOptions = {
  body: TrustPingBody
} & DidCommV2MessageParams

class TrustPingBody {
  @IsBoolean()
  @Expose({ name: 'response_requested' })
  public responseRequested = true
}

export class V2TrustPingMessage extends DidCommV2Message {
  @IsString()
  @IsNotEmpty()
  public from!: string

  @IsObject()
  @ValidateNested()
  @Type(() => TrustPingBody)
  public body!: TrustPingBody

  @IsValidMessageType(V2TrustPingMessage.type)
  public readonly type = V2TrustPingMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/trust-ping/2.0/ping')

  public constructor(options: TrustPingMessageOptions) {
    super(options)

    if (options) {
      this.body = options.body
    }
  }
}
