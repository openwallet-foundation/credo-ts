import { Equals, IsArray, ValidateNested, IsString, IsEnum, IsNotEmpty } from 'class-validator'
import { Type } from 'class-transformer'

import { AgentMessage } from '../../../agent/AgentMessage'
import { RoutingMessageType as MessageType } from './RoutingMessageType'

export interface MediationDeniedMessageOptions {
  id: string
}

/**
 * Used to notify the mediator of keys in use by the recipient.
 *
 * @see https://github.com/hyperledger/aries-rfcs/tree/master/features/0211-route-coordination
 */
export class MediationDeniedMessage extends AgentMessage {
  public constructor(options: MediationDeniedMessageOptions) {
    super()
    this.id = options.id
  }

  @Equals(MediationDeniedMessage.type)
  public readonly type = MediationDeniedMessage.type
  public static readonly type = MessageType.MediationDeny
}
