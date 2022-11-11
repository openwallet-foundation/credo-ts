import type { DIDCommV2MessageParams } from '../../../agent/didcomm'
import type { WitnessMessageType } from '@sicpa-dlab/witness-gossip-protocol-ts'

import { WitnessTable, WitnessTableBody } from '@sicpa-dlab/witness-gossip-protocol-ts'
import { Type } from 'class-transformer'
import { IsString, ValidateNested } from 'class-validator'

import { DIDCommV2Message } from '../../../agent/didcomm'
import { IsValidMessageType, parseMessageType } from '../../../utils/messageType'

export type WitnessTableMessageParams = {
  body: WitnessTableBody
} & DIDCommV2MessageParams

export class WitnessTableMessage extends DIDCommV2Message implements WitnessTable {
  @IsValidMessageType(WitnessTableMessage.type)
  public readonly type = WitnessTableMessage.type.messageTypeUri as WitnessMessageType
  public static readonly type = parseMessageType(WitnessTable.type)

  @IsString()
  public from!: string

  @Type(() => WitnessTableBody)
  @ValidateNested()
  public body!: WitnessTableBody

  public constructor(options?: WitnessTableMessageParams) {
    super(options)
  }
}
