import type { DIDCommV2MessageParams } from '../../../agent/didcomm'

import { Type } from 'class-transformer'
import { IsOptional, IsString, ValidateNested } from 'class-validator'

import { DIDCommV2Message } from '../../../agent/didcomm'
import { IsValidMessageType, parseMessageType } from '../../../utils/messageType'

export type ShareContactRequestMessageOptions = { body: ShareContactRequestBody } & DIDCommV2MessageParams

class ShareContactRequestBody {
  @IsString()
  @IsOptional()
  public label?: string
}

export class ShareContactRequestMessage extends DIDCommV2Message {
  public constructor(options: ShareContactRequestMessageOptions) {
    super(options)

    if (options) {
      this.body = options.body
    }
  }

  @IsValidMessageType(ShareContactRequestMessage.type)
  public readonly type = ShareContactRequestMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/share-contact/1.0/request')

  @IsString()
  public from!: string

  @Type(() => ShareContactRequestBody)
  @ValidateNested()
  public body!: ShareContactRequestBody
}
