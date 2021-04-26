import { Equals } from 'class-validator'

import { AgentMessage } from '../../../agent/AgentMessage'
import { RoutingMessageType as MessageType } from './RoutingMessageType'

export interface MediationRequestMessageOptions {
  id?: string
}

/**
 * This message serves as a request from the recipient to the mediator, asking for the permission (and routing information)
 * to publish the endpoint as a mediator.
 *
 * @see https://github.com/hyperledger/aries-rfcs/blob/master/features/0211-route-coordination/README.md#mediation-request
 */
export class MediationRequestMessage extends AgentMessage {
  public constructor(options: MediationRequestMessageOptions) {
    super()

    if (options) {
      this.id = options.id || this.generateId()
    }
  }

  @Equals(MediationRequestMessage.type)
  public readonly type = MediationRequestMessage.type
  public static readonly type = MessageType.MediationRequest
}
