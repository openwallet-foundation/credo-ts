import type { DIDCommV2MessageParams } from '../../../agent/didcomm'

import { IsString } from 'class-validator'

import { DIDCommV2Message } from '../../../agent/didcomm'
import { IsValidMessageType, parseMessageType } from '../../../utils/messageType'

export type TrustPingResponseMessageV2Params = { thid: string } & DIDCommV2MessageParams

export class TrustPingResponseMessageV2 extends DIDCommV2Message {
  @IsValidMessageType(TrustPingResponseMessageV2.type)
  public readonly type = TrustPingResponseMessageV2.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/trust-ping/2.0/ping-response')

  public constructor(params?: TrustPingResponseMessageV2Params) {
    super(params)
  }

  @IsString()
  public thid!: string
}
