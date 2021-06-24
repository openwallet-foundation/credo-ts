import type { Verkey } from 'indy-sdk'

import { Expose } from 'class-transformer'
import { Equals, IsArray, IsNotEmpty, IsString } from 'class-validator'

import { AgentMessage } from '../../../agent/AgentMessage'

import { RoutingMessageType as MessageType } from './RoutingMessageType'

export interface MediationGrantMessageOptions {
  id: string
  endpoint: string
  routingKeys: Verkey[]
}

/**
 * A route grant message is a signal from the mediator to the recipient that permission is given to distribute the
 * included information as an inbound route.
 *
 * @see https://github.com/hyperledger/aries-rfcs/blob/master/features/0211-route-coordination/README.md#mediation-grant
 */
export class MediationGrantMessage extends AgentMessage {
  public constructor(options: MediationGrantMessageOptions) {
    super()

    if (options) {
      this.id = options.id
      this.endpoint = options.endpoint
      this.routingKeys = options.routingKeys
    }
  }

  @Equals(MediationGrantMessage.type)
  public readonly type = MediationGrantMessage.type
  public static readonly type = MessageType.MediationGrant

  @IsNotEmpty()
  @IsArray()
  @Expose({ name: 'routing_keys' })
  public routingKeys!: Verkey[]

  @IsNotEmpty()
  @IsString()
  public endpoint!: string
}
