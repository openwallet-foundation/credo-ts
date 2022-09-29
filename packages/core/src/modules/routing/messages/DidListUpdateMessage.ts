import type { DIDCommV2MessageParams } from '../../../agent/didcomm'

import { Expose, Type } from 'class-transformer'
import { Equals, IsArray, IsEnum, IsInstance, IsString, ValidateNested } from 'class-validator'

import { DIDCommV2Message } from '../../../agent/didcomm'

import { ListUpdateAction } from './ListUpdateAction'

export class DidListUpdate {
  public constructor(options: { recipientDid: string; action: ListUpdateAction }) {
    if (options) {
      this.recipientDid = options.recipientDid
      this.action = options.action
    }
  }

  @IsString()
  @Expose({ name: 'recipient_did' })
  public recipientDid!: string

  @IsEnum(ListUpdateAction)
  public action!: ListUpdateAction
}

export class DidListUpdateMessageBody {
  @Type(() => DidListUpdate)
  @IsArray()
  @ValidateNested()
  @IsInstance(DidListUpdate, { each: true })
  public updates!: DidListUpdate[]
}

export type DidListUpdateMessageOptions = {
  body: DidListUpdateMessageBody
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

  @Equals(DidListUpdateMessage.type)
  public readonly type = DidListUpdateMessage.type
  public static readonly type = 'https://didcomm.org/coordinate-mediation/2.0/didlist-update'

  @Type(() => DidListUpdateMessageBody)
  @ValidateNested()
  public body!: DidListUpdateMessageBody
}
