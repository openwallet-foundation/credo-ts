import type { DidCommV2MessageParams } from '../../../../../../didcomm'

import { Expose, Type } from 'class-transformer'
import { IsArray, IsEnum, IsString, ValidateNested } from 'class-validator'

import { DidCommV2Message } from '../../../../../../didcomm'
import { IsValidMessageType, parseMessageType } from '../../../../../../utils/messageType'

import { ListUpdateAction } from './ListUpdateAction'

class DidListUpdateBody {
  @Type(() => DidListUpdate)
  @IsArray()
  @ValidateNested({ each: true })
  public updates!: DidListUpdate[]
}

export class DidListUpdate {
  @IsString()
  @Expose({ name: 'recipient_did' })
  public recipientDid!: string

  @IsEnum(() => ListUpdateAction)
  public action!: ListUpdateAction
}

export type DidListUpdateMessageOptions = {
  body: DidListUpdateBody
} & DidCommV2MessageParams

/**
 * A message used to notify the mediator of keys in use by the recipient.
 *
 * @see https://github.com/decentralized-identity/didcomm.org/tree/main/site/content/protocols/mediator-coordination/2.0#keylist-update
 */
export class KeyListUpdateMessage extends DidCommV2Message {
  public constructor(options: DidListUpdateMessageOptions) {
    super(options)

    if (options) {
      this.body = options.body
    }
  }

  @IsValidMessageType(KeyListUpdateMessage.type)
  public readonly type = KeyListUpdateMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/coordinate-mediation/2.0/keylist-update')

  @Type(() => DidListUpdateBody)
  @ValidateNested()
  public body!: DidListUpdateBody
}
