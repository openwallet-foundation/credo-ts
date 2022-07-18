import type { DIDCommV2MessageParams } from '../../../agent/didcomm'

import { Expose, Type } from 'class-transformer'
import { Equals, IsArray, IsEnum, IsInstance, IsString, ValidateNested } from 'class-validator'
import { Verkey } from 'indy-sdk'

import { DIDCommV1Message, DIDCommV2Message } from '../../../agent/didcomm'

import { KeylistUpdateAction } from './KeylistUpdateMessage'

export enum KeylistUpdateResult {
  ClientError = 'client_error',
  ServerError = 'server_error',
  NoChange = 'no_change',
  Success = 'success',
}

export class KeylistUpdated {
  public constructor(options: { recipientKey: Verkey; action: KeylistUpdateAction; result: KeylistUpdateResult }) {
    if (options) {
      this.recipientKey = options.recipientKey
      this.action = options.action
      this.result = options.result
    }
  }

  @IsString()
  @Expose({ name: 'recipient_key' })
  public recipientKey!: Verkey

  @IsEnum(KeylistUpdateAction)
  public action!: KeylistUpdateAction

  @IsEnum(KeylistUpdateResult)
  public result!: KeylistUpdateResult
}

export interface KeylistUpdateResponseMessageOptions {
  id?: string
  keylist: KeylistUpdated[]
  threadId: string
}

/**
 * Used to notify an edge agent with the result of updating the routing keys in the mediator.
 *
 * @see https://github.com/hyperledger/aries-rfcs/blob/master/features/0211-route-coordination/README.md#keylist-update-response
 */
export class KeylistUpdateResponseMessage extends DIDCommV1Message {
  public constructor(options: KeylistUpdateResponseMessageOptions) {
    super()

    if (options) {
      this.id = options.id || this.generateId()
      this.updated = options.keylist
      this.setThread({
        threadId: options.threadId,
      })
    }
  }

  @Equals(KeylistUpdateResponseMessage.type)
  public readonly type = KeylistUpdateResponseMessage.type
  public static readonly type = 'https://didcomm.org/coordinate-mediation/1.0/keylist-update-response'

  @Type(() => KeylistUpdated)
  @IsArray()
  @ValidateNested()
  @IsInstance(KeylistUpdated, { each: true })
  public updated!: KeylistUpdated[]
}

export class KeylistUpdateResponseMessageV2Body {
  @Type(() => KeylistUpdated)
  @IsArray()
  @ValidateNested()
  @IsInstance(KeylistUpdated, { each: true })
  public updated!: KeylistUpdated[]
}

export type KeylistUpdateResponseMessageV2Options = {
  body: KeylistUpdateResponseMessageV2Body
} & DIDCommV2MessageParams

/**
 * Used to notify an edge agent with the result of updating the routing keys in the mediator.
 * DIDComm V2 version of message defined here https://github.com/hyperledger/aries-rfcs/blob/master/features/0211-route-coordination/README.md#keylist-update-response
 */
export class KeylistUpdateResponseMessageV2 extends DIDCommV2Message {
  public constructor(options: KeylistUpdateResponseMessageV2Options) {
    super(options)

    if (options) {
      this.body = options.body
    }
  }

  @Equals(KeylistUpdateResponseMessageV2.type)
  public readonly type = KeylistUpdateResponseMessageV2.type
  public static readonly type = 'https://didcomm.org/coordinate-mediation/2.0/keylist-update-response'

  @Type(() => KeylistUpdateResponseMessageV2Body)
  @ValidateNested()
  public body!: KeylistUpdateResponseMessageV2Body
}
