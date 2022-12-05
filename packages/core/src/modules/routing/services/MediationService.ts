import type { AgentContext } from '../../../agent'
import type { Routing } from '../../connections/services/ConnectionService'
import type { RoutingCreatedEvent } from '../RoutingEvents'

import { EventEmitter } from '../../../agent/EventEmitter'
import { Key, KeyType } from '../../../crypto'
import { injectable } from '../../../plugins'
import { RoutingEventTypes } from '../RoutingEvents'
import { MediationRecipientService } from '../protocol/coordinate-mediation/v1/MediationRecipientService'

@injectable()
export class MediationService {
  private eventEmitter: EventEmitter
  private mediationRecipientService: MediationRecipientService

  public constructor(eventEmitter: EventEmitter, mediationRecipientService: MediationRecipientService) {
    this.eventEmitter = eventEmitter
    this.mediationRecipientService = mediationRecipientService
  }

  public async getRouting(
    agentContext: AgentContext,
    { mediatorId, useDefaultMediator = true }: GetRoutingOptions = {}
  ): Promise<Routing> {
    // Create and store new key
    const { verkey: publicKeyBase58 } = await agentContext.wallet.createDid()

    const recipientKey = Key.fromPublicKeyBase58(publicKeyBase58, KeyType.Ed25519)

    let routing: Routing = {
      endpoints: agentContext.config.endpoints,
      routingKeys: [],
      recipientKey,
    }

    // Extend routing with mediator keys (if applicable)
    routing = await this.mediationRecipientService.addMediationRouting(agentContext, routing, {
      mediatorId,
      useDefaultMediator,
    })

    // Emit event so other parts of the framework can react on keys created
    this.eventEmitter.emit<RoutingCreatedEvent>(agentContext, {
      type: RoutingEventTypes.RoutingCreatedEvent,
      payload: {
        routing,
      },
    })

    return routing
  }
}

export interface GetRoutingOptions {
  /**
   * Identifier of the mediator to use when setting up routing
   */
  mediatorId?: string

  /**
   * Whether to use the default mediator if available and `mediatorId` has not been provided
   * @default true
   */
  useDefaultMediator?: boolean
}
