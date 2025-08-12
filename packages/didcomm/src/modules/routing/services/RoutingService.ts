import type { AgentContext } from '@credo-ts/core'
import type { DidCommRouting } from '../../../models'
import type { RoutingCreatedEvent } from '../RoutingEvents'

import { EventEmitter, Kms, injectable } from '@credo-ts/core'

import { DidCommModuleConfig } from '../../../DidCommModuleConfig'
import { RoutingEventTypes } from '../RoutingEvents'

import { MediationRecipientService } from './MediationRecipientService'

@injectable()
export class RoutingService {
  private mediationRecipientService: MediationRecipientService

  private eventEmitter: EventEmitter

  public constructor(mediationRecipientService: MediationRecipientService, eventEmitter: EventEmitter) {
    this.mediationRecipientService = mediationRecipientService

    this.eventEmitter = eventEmitter
  }

  public async getRouting(
    agentContext: AgentContext,
    { mediatorId, useDefaultMediator = true }: GetRoutingOptions = {}
  ): Promise<DidCommRouting> {
    const kms = agentContext.resolve(Kms.KeyManagementApi)
    const didcommConfig = agentContext.resolve(DidCommModuleConfig)

    // Create and store new key
    const recipientKey = await kms.createKey({ type: { kty: 'OKP', crv: 'Ed25519' } })

    let routing: DidCommRouting = {
      endpoints: didcommConfig.endpoints,
      routingKeys: [],
      recipientKey: Kms.PublicJwk.fromPublicJwk(recipientKey.publicJwk),
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

  public async removeRouting(agentContext: AgentContext, options: RemoveRoutingOptions) {
    await this.mediationRecipientService.removeMediationRouting(agentContext, options)
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

export interface RemoveRoutingOptions {
  /**
   * Keys to remove routing from
   */
  recipientKeys: Kms.PublicJwk<Kms.Ed25519PublicJwk>[]

  /**
   * Identifier of the mediator used when routing has been set up
   */
  mediatorId: string
}
