import type { DIDCommV2MessageParams } from '../../../agent/didcomm'

import { transformUint8Array } from '@sicpa-dlab/value-transfer-protocol-ts'
import { Expose, Transform, Type } from 'class-transformer'
import { Equals, IsNotEmpty, IsObject, IsString, ValidateNested } from 'class-validator'

import { DIDCommV2Message } from '../../../agent/didcomm'

export type MintMessageParams = {
  body: MintMessageBody
} & DIDCommV2MessageParams

export type MintMessageBodyParams = {
  startHash: Uint8Array
  endHash: Uint8Array
}

export class MintMessageBody {
  @IsString()
  @IsNotEmpty()
  @Expose({ name: 'start_hash' })
  @Transform((params) => transformUint8Array(params))
  public startHash: Uint8Array

  @IsString()
  @IsNotEmpty()
  @Expose({ name: 'end_hash' })
  @Transform((params) => transformUint8Array(params))
  public endHash: Uint8Array

  public constructor(params: MintMessageBodyParams) {
    this.startHash = params.startHash
    this.endHash = params.endHash
  }
}

export class MintMessage extends DIDCommV2Message {
  @IsObject()
  @ValidateNested()
  @Type(() => MintMessageBody)
  public body!: MintMessageBody

  @Equals(MintMessage.type)
  public readonly type = MintMessage.type
  public static readonly type = 'https://didcomm.org/mint-cash/1.0/mint'

  public constructor(params?: MintMessageParams) {
    super(params)

    if (params) {
      this.body = params.body
    }
  }
}
