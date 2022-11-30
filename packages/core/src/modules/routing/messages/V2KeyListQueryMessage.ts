import type { DIDCommV2MessageParams } from '../../../agent/didcomm'

import { Type } from 'class-transformer'
import { IsNotEmpty, IsObject, IsString, ValidateNested } from 'class-validator'

import { DIDCommV2Message } from '../../../agent/didcomm'
import { IsValidMessageType, parseMessageType } from '../../../utils/messageType'
import { PaginationQuery } from '../../common/pagination'

export class DidListQuery {
  @IsObject()
  @ValidateNested()
  @Type(() => PaginationQuery)
  public paginate!: PaginationQuery
}

export type DidListQueryMessageOptions = {
  body: DidListQuery
} & DIDCommV2MessageParams

export class V2KeyListQueryMessage extends DIDCommV2Message {
  public constructor(options: DidListQueryMessageOptions) {
    super()

    if (options) {
      this.body = options.body
    }
  }

  @IsString()
  @IsNotEmpty()
  public from!: string

  @IsObject()
  @ValidateNested()
  @Type(() => DidListQuery)
  public body!: DidListQuery

  @IsValidMessageType(V2KeyListQueryMessage.type)
  public readonly type = V2KeyListQueryMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/coordinate-mediation/2.0/keylist-query')
}
