import { Type } from 'class-transformer'
import { Equals, IsArray, ValidateNested } from 'class-validator'

import { AgentMessage } from '../../../agent/AgentMessage'

import { RoutingMessageType as MessageType } from './RoutingMessageType'

export interface KeylistMessageOptions {
  id?: string
}

/**
 * Used to notify the mediator of keys in use by the recipient.
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
  public static readonly type = MessageType.Keylist

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
