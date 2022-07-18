import type { DIDCommV2MessageParams } from '../../../agent/didcomm'

import { Expose, Type } from 'class-transformer'
import { Equals, IsArray, ValidateNested, IsString, IsEnum, IsInstance } from 'class-validator'
import { Verkey } from 'indy-sdk'

import { DIDCommV1Message, DIDCommV2Message } from '../../../agent/didcomm'

export enum KeylistUpdateAction {
  add = 'add',
  remove = 'remove',
}

export class KeylistUpdate {
  public constructor(options: { recipientKey: Verkey; action: KeylistUpdateAction }) {
    if (options) {
      this.recipientKey = options.recipientKey
      this.action = options.action
    }
  }

  @IsString()
  @Expose({ name: 'recipient_key' })
  public recipientKey!: Verkey

  @IsEnum(KeylistUpdateAction)
  public action!: KeylistUpdateAction
}

export interface KeylistUpdateMessageOptions {
  id?: string
  updates: KeylistUpdate[]
}

/**
 * Used to notify the mediator of keys in use by the recipient.
 *
 * @see https://github.com/hyperledger/aries-rfcs/blob/master/features/0211-route-coordination/README.md#keylist-update
 */
export class KeylistUpdateMessage extends DIDCommV1Message {
  public constructor(options: KeylistUpdateMessageOptions) {
    super()

    if (options) {
      this.id = options.id || this.generateId()
      this.updates = options.updates
    }
  }

  @Equals(KeylistUpdateMessage.type)
  public readonly type = KeylistUpdateMessage.type
  public static readonly type = 'https://didcomm.org/coordinate-mediation/1.0/keylist-update'

  @Type(() => KeylistUpdate)
  @IsArray()
  @ValidateNested()
  @IsInstance(KeylistUpdate, { each: true })
  public updates!: KeylistUpdate[]
}

export class KeylistUpdateMessageV2Body {
  @Type(() => KeylistUpdate)
  @IsArray()
  @ValidateNested()
  @IsInstance(KeylistUpdate, { each: true })
  public updates!: KeylistUpdate[]
}

export type KeylistUpdateMessageV2Options = {
  body: KeylistUpdateMessageV2Body
} & DIDCommV2MessageParams

/**
 * Used to notify the mediator of keys in use by the recipient.
 * DIDComm V2 version of message defined here https://github.com/hyperledger/aries-rfcs/blob/master/features/0211-route-coordination/README.md#keylist-update
 */
export class KeylistUpdateMessageV2 extends DIDCommV2Message {
  public constructor(options: KeylistUpdateMessageV2Options) {
    super(options)

    if (options) {
      this.body = options.body
    }
  }

  @Equals(KeylistUpdateMessageV2.type)
  public readonly type = KeylistUpdateMessageV2.type
  public static readonly type = 'https://didcomm.org/coordinate-mediation/2.0/keylist-update'

  @Type(() => KeylistUpdateMessageV2Body)
  @ValidateNested()
  public body!: KeylistUpdateMessageV2Body
}
