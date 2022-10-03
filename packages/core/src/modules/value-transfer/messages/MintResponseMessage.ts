import type { DIDCommV2MessageParams } from '../../../agent/didcomm'

import { MintResponse } from '@sicpa-dlab/value-transfer-protocol-ts'
import { IsString } from 'class-validator'

import { DIDCommV2Message } from '../../../agent/didcomm'
import { IsValidMessageType, parseMessageType } from '../../../utils/messageType'

export type MintResponseMessageParams = { thid: string } & DIDCommV2MessageParams

export class MintResponseMessage extends DIDCommV2Message {
  @IsValidMessageType(MintResponseMessage.type)
  public readonly type = MintResponseMessage.type.messageTypeUri
  public static readonly type = parseMessageType(MintResponse.type)

  public constructor(params?: MintResponseMessageParams) {
    super(params)
  }

  @IsString()
  public thid!: string
}
