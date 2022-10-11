import type { DIDCommV2MessageParams } from '../../../agent/didcomm'

import { Type } from 'class-transformer'
import { IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator'

import { DIDCommV2Message } from '../../../agent/didcomm'
import { IsValidMessageType, parseMessageType } from '../../../utils/messageType'

export type TellDidRequestMessageOptions = { body: TellDidRequestBody } & DIDCommV2MessageParams

class TellDidRequestBody {
  @IsString()
  @IsNotEmpty()
  public did!: string

  @IsString()
  @IsOptional()
  public label?: string
}

export class TellDidMessage extends DIDCommV2Message {
  public constructor(options: TellDidRequestMessageOptions) {
    super(options)

    if (options) {
      this.body = options.body
    }
  }

  @IsValidMessageType(TellDidMessage.type)
  public readonly type = TellDidMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/tell-did/1.0/request')

  @IsString()
  public from!: string

  @Type(() => TellDidRequestBody)
  @ValidateNested()
  public body!: TellDidRequestBody
}
