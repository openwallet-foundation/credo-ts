import type { DIDCommV2MessageParams } from '../../../agent/didcomm'

import { Type } from 'class-transformer'
import { Equals, IsInstance, ValidateNested } from 'class-validator'

import { DIDCommV2Message } from '../../../agent/didcomm'

export type WitnessTableQueryMessageParams = {
  body: WitnessTableQueryMessageBody
} & DIDCommV2MessageParams

export class WitnessTableQueryMessageBody {}

export class WitnessTableQueryMessage extends DIDCommV2Message {
  @Equals(WitnessTableQueryMessage.type)
  public readonly type = WitnessTableQueryMessage.type
  public static readonly type = 'https://didcomm.org/wgp/1.0/witness-table-query'

  @Type(() => WitnessTableQueryMessageBody)
  @ValidateNested()
  @IsInstance(WitnessTableQueryMessageBody)
  public body!: WitnessTableQueryMessageBody

  public constructor(options?: WitnessTableQueryMessageParams) {
    super(options)
  }
}
