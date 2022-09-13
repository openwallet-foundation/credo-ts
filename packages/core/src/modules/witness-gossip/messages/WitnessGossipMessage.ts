import type { DIDCommV2MessageParams } from '../../../agent/didcomm'

import { Attachment, WitnessGossipInfoBody } from '@sicpa-dlab/value-transfer-protocol-ts'
import { Type } from 'class-transformer'
import { Equals, IsOptional, IsString, ValidateNested } from 'class-validator'

import { DIDCommV2Message } from '../../../agent/didcomm'

export type WitnessGossipMessageParams = DIDCommV2MessageParams

export class WitnessGossipMessage extends DIDCommV2Message {
  @Equals(WitnessGossipMessage.type)
  public readonly type = WitnessGossipMessage.type
  public static readonly type = 'https://didcomm.org/wgp/1.0/info'

  @IsString()
  public from!: string

  @Type(() => WitnessGossipInfoBody)
  @ValidateNested()
  public body!: WitnessGossipInfoBody

  @Type(() => Attachment)
  @IsOptional()
  public attachments?: Array<Attachment>

  public constructor(options?: WitnessGossipMessageParams) {
    super(options)
  }
}
