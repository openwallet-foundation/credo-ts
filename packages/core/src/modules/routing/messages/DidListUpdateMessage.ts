import type { DIDCommV2MessageParams } from '../../../agent/didcomm'

import { Expose, Type } from 'class-transformer'
import { IsArray, IsEnum, IsString, ValidateNested } from 'class-validator'

import { DIDCommV2Message } from '../../../agent/didcomm'
import { IsValidMessageType, parseMessageType } from '../../../utils/messageType'

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
} & DIDCommV2MessageParams

/**
 * Used to notify the mediator of dids in use by the recipient.
 */
export class DidListUpdateMessage extends DIDCommV2Message {
  public constructor(options: DidListUpdateMessageOptions) {
    super(options)

    if (options) {
      this.body = options.body
    }
  }

  @IsValidMessageType(DidListUpdateMessage.type)
  public readonly type = DidListUpdateMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/coordinate-mediation/2.0/keylist-update')

  @Type(() => DidListUpdateBody)
  @ValidateNested()
  public body!: DidListUpdateBody
}
