import type { DIDCommV2MessageParams } from '../../../agent/didcomm'

import { WitnessMessageType, WitnessTableQuery, WitnessTableQueryBody } from '@sicpa-dlab/witness-gossip-protocol-ts'
import { Type } from 'class-transformer'
import { IsInstance, IsString, ValidateNested } from 'class-validator'

import { DIDCommV2Message } from '../../../agent/didcomm'
import { IsValidMessageType, parseMessageType } from '../../../utils/messageType'

export type WitnessTableQueryMessageParams = {
  body: WitnessTableQueryBody
} & DIDCommV2MessageParams

export class WitnessTableQueryMessage extends DIDCommV2Message implements WitnessTableQuery {
  @IsValidMessageType(WitnessTableQueryMessage.type)
  public readonly type: WitnessMessageType = WitnessTableQueryMessage.type.messageTypeUri as WitnessMessageType
  public static readonly type = parseMessageType(WitnessTableQuery.type)

  @IsString()
  public from!: string

  @Type(() => WitnessTableQueryBody)
  @ValidateNested()
  @IsInstance(WitnessTableQueryBody)
  public body!: WitnessTableQueryBody

  public constructor(options?: WitnessTableQueryMessageParams) {
    super(options)
  }
}
