import { Equals, IsArray, ValidateNested, IsString, IsEnum, IsNotEmpty, isNotEmptyObject } from 'class-validator'
import { Type } from 'class-transformer'

import { AgentMessage } from '../../../agent/AgentMessage'
import { RoutingMessageType as MessageType } from './RoutingMessageType'
import { Verkey } from 'indy-sdk'

export interface MediationGrantedMessageOptions {
  id: string
  endpoint: string
  routingKeys: [Verkey]
}

/**
 * Used to notify the mediator of keys in use by the recipient.
 *
 * @see https://github.com/hyperledger/aries-rfcs/tree/master/features/0211-route-coordination
 */
export class MediationGrantedMessage extends AgentMessage {
  public constructor(options: MediationGrantedMessageOptions) {
    super()
    this.id = options.id
    this.routingKeys = options.routingKeys
    this.endpoint = options.endpoint
  }

  @IsNotEmpty()
  public routingKeys: [Verkey]
  public endpoint: string
  public id: string

  @Equals(MediationGrantedMessage.type)
  public readonly type = MediationGrantedMessage.type
  public static readonly type = MessageType.MediationGrant
}
