import type { DIDCommV2MessageParams } from '../../../agent/didcomm'

import { Type } from 'class-transformer'
import { IsEnum, IsString, ValidateNested } from 'class-validator'

import { DIDCommV2Message } from '../../../agent/didcomm'
import { IsValidMessageType, parseMessageType } from '../../../utils/messageType'

export enum ShareContactResult {
  Accepted = 'accepted',
  Declined = 'declined',
}

export type ShareContactResponseMessageOptions = { body: ShareContactResponseBody } & DIDCommV2MessageParams

class ShareContactResponseBody {
  @IsEnum(ShareContactResult)
  public result!: ShareContactResult
}

export class ShareContactResponseMessage extends DIDCommV2Message {
  public constructor(options: ShareContactResponseMessageOptions) {
    super(options)

    if (options) {
      this.body = options.body
    }
  }

  @IsValidMessageType(ShareContactResponseMessage.type)
  public readonly type = ShareContactResponseMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/share-contact/1.0/response')

  @IsString()
  public thid!: string

  @IsString()
  public from!: string

  @Type(() => ShareContactResponseBody)
  @ValidateNested()
  public body!: ShareContactResponseBody
}
