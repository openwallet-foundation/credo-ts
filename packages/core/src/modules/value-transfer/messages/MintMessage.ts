import type { DIDCommV2MessageParams } from '../../../agent/didcomm'

import { transformUint8Array } from '@sicpa-dlab/value-transfer-protocol-ts'
import { Expose, Transform, Type } from 'class-transformer'
import { Equals, IsArray, IsObject, IsOptional, ValidateNested } from 'class-validator'

import { DIDCommV2Message } from '../../../agent/didcomm'

export type MintMessageParams = {
  body: MintMessageBody
  please_ack?: string[]
} & DIDCommV2MessageParams

export class MintMessageBody {
  @Expose({ name: 'start_hash' })
  @Transform((params) => transformUint8Array(params))
  public startHash!: Uint8Array | null

  @Expose({ name: 'end_hash' })
  @Transform((params) => transformUint8Array(params))
  public endHash!: Uint8Array
}

export class MintMessage extends DIDCommV2Message {
  @IsObject()
  @ValidateNested()
  @Type(() => MintMessageBody)
  public body!: MintMessageBody

  @Equals(MintMessage.type)
  public readonly type = MintMessage.type
  public static readonly type = 'https://didcomm.org/vtp/1.0/mint'

  public constructor(params?: MintMessageParams) {
    super(params)

    if (params) {
      this.body = params.body
    }
  }

  @IsArray()
  @IsOptional()
  public please_ack?: Array<string>
}
