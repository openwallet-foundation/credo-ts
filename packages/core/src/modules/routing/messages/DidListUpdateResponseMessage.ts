import type { DIDCommV2MessageParams } from '../../../agent/didcomm'

import { Expose, Type } from 'class-transformer'
import { Equals, IsArray, IsEnum, IsInstance, IsString, ValidateNested } from 'class-validator'

import { DIDCommV2Message } from '../../../agent/didcomm'

import { ListUpdateAction } from './KeylistUpdateMessage'
import { ListUpdateResult } from './KeylistUpdateResponseMessage'

export class DidListUpdated {
  public constructor(options: { recipientDid: string; action: ListUpdateAction; result: ListUpdateResult }) {
    if (options) {
      this.recipientDid = options.recipientDid
      this.action = options.action
      this.result = options.result
    }
  }

  @IsString()
  @Expose({ name: 'recipient_key' })
  public recipientDid!: string

  @IsEnum(ListUpdateAction)
  public action!: ListUpdateAction

  @IsEnum(ListUpdateResult)
  public result!: ListUpdateResult
}

export class DidListUpdateResponseMessageBody {
  @Type(() => DidListUpdated)
  @IsArray()
  @ValidateNested()
  @IsInstance(DidListUpdated, { each: true })
  public updated!: DidListUpdated[]
}

export type DidListUpdateResponseMessageOptions = {
  body: DidListUpdateResponseMessageBody
} & DIDCommV2MessageParams

/**
 * Used to notify an edge agent with the result of updating the routing keys in the mediator.
 */
export class DidListUpdateResponseMessage extends DIDCommV2Message {
  public constructor(options: DidListUpdateResponseMessageOptions) {
    super(options)

    if (options) {
      this.body = options.body
    }
  }

  @Equals(DidListUpdateResponseMessage.type)
  public readonly type = DidListUpdateResponseMessage.type
  public static readonly type = 'https://didcomm.org/coordinate-mediation/2.0/didlist-update-response'

  @Type(() => DidListUpdateResponseMessageBody)
  @ValidateNested()
  public body!: DidListUpdateResponseMessageBody
}
