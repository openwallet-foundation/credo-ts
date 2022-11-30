import type { DIDCommV2MessageParams } from '../../../agent/didcomm'

import { Expose, Type } from 'class-transformer'
import { IsArray, IsObject, IsString, ValidateNested } from 'class-validator'

import { DIDCommV2Message } from '../../../agent/didcomm'
import { IsValidMessageType, parseMessageType } from '../../../utils/messageType'
import { PageInfo } from '../../common/pagination'

export class DidListResponseItem {
  @IsString()
  @Expose({ name: 'recipient_did' })
  public recipientDid!: string

  public constructor(recipientDid: string) {
    this.recipientDid = recipientDid
  }
}

export class DidListMessageBody {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DidListResponseItem)
  public dids!: DidListResponseItem[]

  @IsObject()
  @ValidateNested()
  @Type(() => PageInfo)
  public pagination!: PageInfo
}

export type DidListMessageOptions = {
  body: DidListMessageBody
} & DIDCommV2MessageParams

export class DidListResponseMessage extends DIDCommV2Message {
  public constructor(options: DidListMessageOptions) {
    super()

    if (options) {
      this.body = options.body
    }
  }

  @IsValidMessageType(DidListResponseMessage.type)
  public readonly type = DidListResponseMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/coordinate-mediation/2.0/keylist')

  @Type(() => DidListMessageBody)
  @ValidateNested()
  public body!: DidListMessageBody
}
