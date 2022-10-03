import type { DIDCommV2MessageParams } from '../../../agent/didcomm'

import { GossipAttachment, WitnessGossipInfo, WitnessGossipInfoBody } from '@sicpa-dlab/value-transfer-protocol-ts'
import { Type } from 'class-transformer'
import { IsOptional, IsString, ValidateNested } from 'class-validator'

import { DIDCommV2Message } from '../../../agent/didcomm'
import { IsValidMessageType, parseMessageType } from '../../../utils/messageType'

export type WitnessGossipMessageParams = DIDCommV2MessageParams

export class WitnessGossipMessage extends DIDCommV2Message {
  @IsValidMessageType(WitnessGossipMessage.type)
  public readonly type: string = WitnessGossipMessage.type.messageTypeUri
  public static readonly type = parseMessageType(WitnessGossipInfo.type)

  @IsString()
  public from!: string

  @Type(() => WitnessGossipInfoBody)
  @ValidateNested()
  public body!: WitnessGossipInfoBody

  @Type(() => GossipAttachment)
  @IsOptional()
  public attachments?: Array<GossipAttachment>

  public constructor(options?: WitnessGossipMessageParams) {
    super(options)
  }
}
