import type { DIDCommV2MessageParams } from '../../../agent/didcomm/'

import { Expose, Type } from 'class-transformer'
import { Equals, IsObject, IsString, ValidateNested } from 'class-validator'

import { DIDCommV1Message, DIDCommV2Message } from '../../../agent/didcomm/'
import { EncryptedMessage } from '../../../agent/didcomm/types'

export interface ForwardMessageOptions {
  id?: string
  to: string
  message: EncryptedMessage
}

/**
 * @see https://github.com/hyperledger/aries-rfcs/blob/master/concepts/0094-cross-domain-messaging/README.md#corerouting10forward
 */
export class ForwardMessage extends DIDCommV1Message {
  /**
   * Create new ForwardMessage instance.
   *
   * @param options
   */
  public constructor(options: ForwardMessageOptions) {
    super()

    if (options) {
      this.id = options.id || this.generateId()
      this.to = options.to
      this.message = options.message
    }
  }

  @Equals(ForwardMessage.type)
  public readonly type = ForwardMessage.type
  public static readonly type = 'https://didcomm.org/routing/1.0/forward'

  @IsString()
  public to!: string

  @Expose({ name: 'msg' })
  @IsObject()
  public message!: EncryptedMessage
}

export class ForwardMessageV2Body {
  @IsString()
  public next!: string
}

export type ForwardMessageV2Options = {
  body: ForwardMessageV2Body
} & DIDCommV2MessageParams

/**
 * DIDComm V2 version of message defined here https://github.com/hyperledger/aries-rfcs/blob/master/concepts/0094-cross-domain-messaging/README.md#corerouting10forward
 */
export class ForwardMessageV2 extends DIDCommV2Message {
  /**
   * Create new ForwardMessage instance.
   *
   * @param options
   */
  public constructor(options: ForwardMessageV2Options) {
    super(options)

    if (options) {
      this.body = options.body
    }
  }

  @Equals(ForwardMessageV2.type)
  public readonly type = ForwardMessageV2.type
  public static readonly type = 'https://didcomm.org/routing/2.0/forward'

  @Type(() => ForwardMessageV2Body)
  @ValidateNested()
  public body!: ForwardMessageV2Body
}
