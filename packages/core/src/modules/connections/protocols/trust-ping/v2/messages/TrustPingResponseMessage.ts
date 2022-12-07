import type { DidCommV2MessageParams } from '../../../../../../didcomm/versions/v2'

import { IsNotEmpty, IsString } from 'class-validator'

import { DidCommV2Message } from '../../../../../../didcomm'
import { IsValidMessageType, parseMessageType } from '../../../../../../utils/messageType'

export type TrustPingResponseMessageParams = { thid: string } & DidCommV2MessageParams

export class TrustPingResponseMessage extends DidCommV2Message {
  public constructor(options: TrustPingResponseMessageParams) {
    super(options)
    if (options) {
      this.thid = options.thid
    }
  }

  @IsString()
  @IsNotEmpty()
  public from!: string

  @IsValidMessageType(TrustPingResponseMessage.type)
  public readonly type = TrustPingResponseMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/trust-ping/2.0/ping-response')

  @IsString()
  public thid!: string
}
