import { Type } from 'class-transformer'
import { Equals, IsArray, ValidateNested } from 'class-validator'

import { AgentMessage } from '../../../agent/AgentMessage'

export interface KeylistMessageOptions {
  id?: string
}

/**
 * Used to notify the recipient of keys in use by the mediator.
 *
 * @see https://github.com/hyperledger/aries-rfcs/blob/master/features/0211-route-coordination/README.md#keylist
 */
export class KeylistMessage extends AgentMessage {
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
