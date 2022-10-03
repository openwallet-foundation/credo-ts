import type { DIDCommV2MessageParams } from '../../../agent/didcomm'

import { WitnessTable } from '@sicpa-dlab/value-transfer-protocol-ts'
import { Type } from 'class-transformer'
import { IsInstance, IsOptional, IsString, ValidateNested } from 'class-validator'

import { DIDCommV2Message } from '../../../agent/didcomm'
import { IsValidMessageType, parseMessageType } from '../../../utils/messageType'

export type WitnessDataParams = {
  did: string
  type?: string
  label?: string
}

export class WitnessData {
  @IsString()
  public did!: string

  @IsString()
  @IsOptional()
  public type?: string

  @IsString()
  @IsOptional()
  public label?: string

  public constructor(options?: WitnessDataParams) {
    if (options) {
      this.did = options.did
      this.type = options.type
      this.label = options.label
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
  @IsValidMessageType(WitnessTableMessage.type)
  public readonly type: string = WitnessTableMessage.type.messageTypeUri
  public static readonly type = parseMessageType(WitnessTable.type)

  @Type(() => WitnessTableMessageBody)
  @ValidateNested()
  @IsInstance(WitnessTableMessageBody)
  public body!: WitnessTableMessageBody

  public constructor(options?: WitnessTableMessageParams) {
    super(options)
  }
}
