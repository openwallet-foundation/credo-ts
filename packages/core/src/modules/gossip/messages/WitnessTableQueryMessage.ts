import type { DIDCommV2MessageParams } from '../../../agent/didcomm'

import { WitnessTableQuery } from '@sicpa-dlab/value-transfer-protocol-ts'
import { Type } from 'class-transformer'
import { IsInstance, IsString, ValidateNested } from 'class-validator'

import { DIDCommV2Message } from '../../../agent/didcomm'
import { IsValidMessageType, parseMessageType } from '../../../utils/messageType'

export type WitnessTableQueryMessageParams = {
  body: WitnessTableQueryMessageBody
} & DIDCommV2MessageParams

export class WitnessTableQueryMessageBody {}

export class WitnessTableQueryMessage extends DIDCommV2Message {
  @IsValidMessageType(WitnessTableQueryMessage.type)
  public readonly type: string = WitnessTableQueryMessage.type.messageTypeUri
  public static readonly type = parseMessageType(WitnessTableQuery.type)

  @Type(() => WitnessTableQueryMessageBody)
  @ValidateNested()
  @IsInstance(WitnessTableQueryMessageBody)
  public body!: WitnessTableQueryMessageBody

  @IsString()
  public from!: string

  public constructor(options?: WitnessTableQueryMessageParams) {
    super(options)
  }
}
