import type { DIDCommV2MessageParams } from '../../../agent/didcomm'

import { Expose, Type } from 'class-transformer'
import { Equals, IsArray, IsObject, IsString, ValidateNested } from 'class-validator'

import { DIDCommV2Message } from '../../../agent/didcomm'
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

  @Equals(DidListResponseMessage.type)
  public readonly type = DidListResponseMessage.type
  public static readonly type = 'https://didcomm.org/coordinate-mediation/2.0/didlist'

  @Type(() => DidListMessageBody)
  @ValidateNested()
  public body!: DidListMessageBody
}
