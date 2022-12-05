import type { DidCommV2MessageParams } from '../../../../../../didcomm'

import { Type } from 'class-transformer'
import { IsNotEmpty, IsObject, IsString, ValidateNested } from 'class-validator'

import { DidCommV2Message } from '../../../../../../didcomm'
import { IsValidMessageType, parseMessageType } from '../../../../../../utils/messageType'
import { PaginationQuery } from '../../../../../common/pagination'

export class DidListQuery {
  @IsObject()
  @ValidateNested()
  @Type(() => PaginationQuery)
  public paginate!: PaginationQuery
}

export type DidListQueryMessageOptions = {
  body: DidListQuery
} & DidCommV2MessageParams

/**
 * A message that contains query to mediator for a list of keys registered for this connection.
 *
 * @see https://github.com/decentralized-identity/didcomm.org/tree/main/site/content/protocols/mediator-coordination/2.0#keylist-query
 */
export class KeyListQueryMessage extends DidCommV2Message {
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

  @IsValidMessageType(KeyListQueryMessage.type)
  public readonly type = KeyListQueryMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/coordinate-mediation/2.0/keylist-query')
}
