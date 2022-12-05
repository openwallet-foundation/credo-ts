import type { DidCommV2MessageParams } from '../../../../../../didcomm'

import { Expose, Type } from 'class-transformer'
import { IsArray, IsObject, IsString, ValidateNested } from 'class-validator'

import { DidCommV2Message } from '../../../../../../didcomm'
import { IsValidMessageType, parseMessageType } from '../../../../../../utils/messageType'
import { PageInfo } from '../../../../../common/pagination'

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
} & DidCommV2MessageParams

/**
 * A message that contains retrieved keys.
 *
 * @see https://github.com/decentralized-identity/didcomm.org/tree/main/site/content/protocols/mediator-coordination/2.0#keylist
 */
export class KeyListResponseMessage extends DidCommV2Message {
  public constructor(options: DidListMessageOptions) {
    super()

    if (options) {
      this.body = options.body
    }
  }

  @IsValidMessageType(KeyListResponseMessage.type)
  public readonly type = KeyListResponseMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/coordinate-mediation/2.0/keylist')

  @Type(() => DidListMessageBody)
  @ValidateNested()
  public body!: DidListMessageBody
}
