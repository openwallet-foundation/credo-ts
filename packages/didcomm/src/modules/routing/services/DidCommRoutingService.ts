import type { AgentContext } from '@credo-ts/core'
import { EventEmitter, injectable, Kms } from '@credo-ts/core'
import { DidCommModuleConfig } from '../../../DidCommModuleConfig'
import type { DidCommRouting } from '../../../models'
import type { DidCommV2KeyAgreementJwk } from '../../../v2/types'
import { keyTypeForCurve } from '../../../v2/types'
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

    // Create separate keyAgreement key for V2 (ECDH-ES / ECDH-1PU) only when the agent
    // supports DIDComm V2. V1-only agents derive X25519 from Ed25519 at runtime via Askar's
    // birational map, so no separate key is needed. Curve selected via
    // DidCommModuleConfig.v2KeyAgreementCurve (X25519 default; P-256 and P-384 supported).
    let keyAgreementKey: DidCommV2KeyAgreementJwk | undefined
    if (didcommConfig.acceptsV2) {
      const createdKeyAgreementKey = await kms.createKey({
        type: keyTypeForCurve(didcommConfig.v2KeyAgreementCurve),
      })
      keyAgreementKey = Kms.PublicJwk.fromPublicJwk(createdKeyAgreementKey.publicJwk) as DidCommV2KeyAgreementJwk
      keyAgreementKey.keyId = createdKeyAgreementKey.keyId
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
   * Recipient keys to remove routing from. May include both Ed25519 and X25519 keys.
   * V1 mediators only use Ed25519 keys; V2 mediators use both directly (as did:key).
   * X25519 keys are passed through as-is without birational derivation.
   */
  recipientKeys: (Kms.PublicJwk<Kms.Ed25519PublicJwk> | Kms.PublicJwk<Kms.X25519PublicJwk>)[]

  /**
   * Identifier of the mediator used when routing has been set up
   */
  mediatorId: string
}
