import type { DIDCommV2MessageParams } from '../../../agent/didcomm'

import { Equals, IsString } from 'class-validator'

import { DIDCommV2Message } from '../../../agent/didcomm'

export type MintResponseMessageParams = { thid: string } & DIDCommV2MessageParams

export class MintResponseMessage extends DIDCommV2Message {
  @Equals(MintResponseMessage.type)
  public readonly type = MintResponseMessage.type
  public static readonly type = 'https://didcomm.org/vtp/1.0/mint-response'

  public constructor(params?: MintResponseMessageParams) {
    super(params)
  }

  @IsString()
  public thid!: string
}
