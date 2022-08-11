import type { DIDCommV2MessageParams } from '../../../agent/didcomm'

import { Type } from 'class-transformer'
import { Equals, IsInstance, IsOptional, IsString, ValidateNested } from 'class-validator'

import { DIDCommV2Message } from '../../../agent/didcomm'

export type WitnessDataParams = {
  did: string
  type?: string
}

export class WitnessData {
  @IsString()
  public did!: string

  @IsString()
  @IsOptional()
  public type?: string

  public constructor(options?: WitnessDataParams) {
    if (options) {
      this.did = options.did
      this.type = options.type
    }
  }
}

export type WitnessTableMessageBodyParams = {
  witnesses: Array<WitnessData>
}

export type WitnessTableMessageParams = {
  body: WitnessTableMessageBody
} & DIDCommV2MessageParams

export class WitnessTableMessageBody {
  @Type(() => WitnessData)
  public witnesses!: Array<WitnessData>

  public constructor(options?: WitnessTableMessageBodyParams) {
    if (options) {
      this.witnesses = options.witnesses
    }
  }
}

export class WitnessTableMessage extends DIDCommV2Message {
  @Equals(WitnessTableMessage.type)
  public readonly type = WitnessTableMessage.type
  public static readonly type = 'https://didcomm.org/wgp/1.0/witness-table'

  @Type(() => WitnessTableMessageBody)
  @ValidateNested()
  @IsInstance(WitnessTableMessageBody)
  public body!: WitnessTableMessageBody

  public constructor(options?: WitnessTableMessageParams) {
    super(options)
  }
}
