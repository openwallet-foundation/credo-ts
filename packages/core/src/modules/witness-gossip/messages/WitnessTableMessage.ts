import type { DIDCommV2MessageParams } from '../../../agent/didcomm'

import { Type } from 'class-transformer'
import { Equals, IsInstance, ValidateNested } from 'class-validator'

import { DIDCommV2Message } from '../../../agent/didcomm'
import { WitnessData } from '../../value-transfer/repository/WitnessStateRecord'

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
