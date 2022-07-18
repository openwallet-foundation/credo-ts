import type { DIDCommV2MessageParams } from '../../../agent/didcomm'

import { Type } from 'class-transformer'
import { Equals, IsArray, ValidateNested } from 'class-validator'

import { DIDCommV1Message, DIDCommV2Message } from '../../../agent/didcomm'

export interface KeylistMessageOptions {
  id?: string
}

/**
 * Used to notify the recipient of keys in use by the mediator.
 *
 * @see https://github.com/hyperledger/aries-rfcs/blob/master/features/0211-route-coordination/README.md#keylist
 */
export class KeylistMessage extends DIDCommV1Message {
  public constructor(options: KeylistMessageOptions) {
    super()

    if (options) {
      this.id = options.id || this.generateId()
    }
  }

  @Equals(KeylistMessage.type)
  public readonly type = KeylistMessage.type
  public static readonly type = 'https://didcomm.org/coordinate-mediation/1.0/keylist'

  @Type(() => Keylist)
  @IsArray()
  @ValidateNested()
  public updates!: Keylist[]
}

export class Keylist {
  public constructor(options: { paginateOffset: number }) {
    return options
  }
}

export class KeylistMessageV2Body {
  @Type(() => Keylist)
  @IsArray()
  @ValidateNested()
  public updates!: Keylist[]
}

export type KeylistMessageV2Options = {
  body: KeylistMessageV2Body
} & DIDCommV2MessageParams

export class KeylistMessageV2 extends DIDCommV2Message {
  public constructor(options: KeylistMessageV2Options) {
    super()

    if (options) {
      this.body = options.body
    }
  }

  @Equals(KeylistMessageV2.type)
  public readonly type = KeylistMessageV2.type
  public static readonly type = 'https://didcomm.org/coordinate-mediation/2.0/keylist'

  @Type(() => KeylistMessageV2Body)
  @ValidateNested()
  public body!: KeylistMessageV2Body
}
