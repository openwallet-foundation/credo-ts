import type { DIDCommV2MessageParams } from '../../../agent/didcomm'

import { Type } from 'class-transformer'
import { IsEnum, IsString, ValidateNested } from 'class-validator'

import { DIDCommV2Message } from '../../../agent/didcomm'
import { IsValidMessageType, parseMessageType } from '../../../utils/messageType'

export enum TellDidResult {
  Accepted,
  Declined,
}

export type TellDidResponseMessageOptions = { body: TellDidResponseBody } & DIDCommV2MessageParams

class TellDidResponseBody {
  @IsEnum(TellDidResult)
  public result!: TellDidResult
}

export class TellDidResponseMessage extends DIDCommV2Message {
  public constructor(options: TellDidResponseMessageOptions) {
    super(options)

    if (options) {
      this.body = options.body
    }
  }

  @IsValidMessageType(TellDidResponseMessage.type)
  public readonly type = TellDidResponseMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/tell-did/1.0/response')

  @IsString()
  public thid!: string

  @IsString()
  public from!: string

  @Type(() => TellDidResponseBody)
  @ValidateNested()
  public body!: TellDidResponseBody
}
