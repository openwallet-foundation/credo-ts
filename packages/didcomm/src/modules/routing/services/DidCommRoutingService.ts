import type { AgentContext } from '@credo-ts/core'
import { EventEmitter, injectable, Kms } from '@credo-ts/core'
import { DidCommModuleConfig } from '../../../DidCommModuleConfig'
import type { DidCommRouting } from '../../../models'
import type { DidCommRoutingCreatedEvent } from '../DidCommRoutingEvents'
import { DidCommRoutingEventTypes } from '../DidCommRoutingEvents'

import { DidCommMediationRecipientService } from './DidCommMediationRecipientService'

@injectable()
export class DidCommRoutingService {
  private mediationRecipientService: DidCommMediationRecipientService

  private eventEmitter: EventEmitter

  public constructor(mediationRecipientService: DidCommMediationRecipientService, eventEmitter: EventEmitter) {
    this.mediationRecipientService = mediationRecipientService

    this.eventEmitter = eventEmitter
  }

  public async getRouting(
    agentContext: AgentContext,
    { mediatorId, useDefaultMediator = true }: GetRoutingOptions = {}
  ): Promise<DidCommRouting> {
    const kms = agentContext.resolve(Kms.KeyManagementApi)
    const didcommConfig = agentContext.resolve(DidCommModuleConfig)

    // Create Ed25519 key for authentication/signing (used by V1 and V2).
    const createdKey = await kms.createKey({ type: { kty: 'OKP', crv: 'Ed25519' } })
    const recipientKey = Kms.PublicJwk.fromPublicJwk(createdKey.publicJwk)
    recipientKey.keyId = createdKey.keyId

    // Create separate X25519 key for V2 key agreement (ECDH-ES / ECDH-1PU) only
    // when the agent supports DIDComm V2. V1-only agents derive X25519 from Ed25519
    // at runtime via Askar's birational map, so no separate key is needed.
    let keyAgreementKey: Kms.PublicJwk<Kms.X25519PublicJwk> | undefined
    if (didcommConfig.acceptsV2) {
      const createdX25519Key = await kms.createKey({ type: { kty: 'OKP', crv: 'X25519' } })
      keyAgreementKey = Kms.PublicJwk.fromPublicJwk(createdX25519Key.publicJwk)
      keyAgreementKey.keyId = createdX25519Key.keyId
    }

    let routing: DidCommRouting = {
      endpoints: didcommConfig.endpoints,
      routingKeys: [],
      recipientKey,
      keyAgreementKey,
    }

    // Extend routing with mediator keys (if applicable)
    routing = await this.mediationRecipientService.addMediationRouting(agentContext, routing, {
      mediatorId,
      useDefaultMediator,
    })

    // Emit event so other parts of the framework can react on keys created
    this.eventEmitter.emit<DidCommRoutingCreatedEvent>(agentContext, {
      type: DidCommRoutingEventTypes.RoutingCreatedEvent,
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
   * Ed25519 recipient keys to remove routing from (used by both V1 and V2 mediators).
   */
  recipientKeys: Kms.PublicJwk<Kms.Ed25519PublicJwk>[]

  /**
   * Optional separate X25519 key agreement keys to remove from V2 mediator keylist.
   * When provided, these are removed directly (not derived from recipientKeys).
   */
  keyAgreementKeys?: Kms.PublicJwk<Kms.X25519PublicJwk>[]

  /**
   * Identifier of the mediator used when routing has been set up
   */
  mediatorId: string
}
