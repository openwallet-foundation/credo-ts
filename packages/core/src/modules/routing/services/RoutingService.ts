import type { Routing } from '../../connections'
import type { RoutingCreatedEvent } from '../RoutingEvents'

import { inject, Lifecycle, scoped } from 'tsyringe'

import { AgentConfig } from '../../../agent/AgentConfig'
import { EventEmitter } from '../../../agent/EventEmitter'
import { InjectionSymbols } from '../../../constants'
import { KeyType } from '../../../crypto'
import { Wallet } from '../../../wallet'
import { Key } from '../../dids'
import { RoutingEventTypes } from '../RoutingEvents'

import { MediationRecipientService } from './MediationRecipientService'

@scoped(Lifecycle.ContainerScoped)
export class RoutingService {
  private mediationRecipientService: MediationRecipientService
  private agentConfig: AgentConfig
  private wallet: Wallet
  private eventEmitter: EventEmitter

  public constructor(
    mediationRecipientService: MediationRecipientService,
    agentConfig: AgentConfig,
    @inject(InjectionSymbols.Wallet) wallet: Wallet,
    eventEmitter: EventEmitter
  ) {
    this.mediationRecipientService = mediationRecipientService
    this.agentConfig = agentConfig
    this.wallet = wallet
    this.eventEmitter = eventEmitter
  }

  public async getRouting({ mediatorId, useDefaultMediator = true }: GetRoutingOptions = {}): Promise<Routing> {
    // Create and store new key
    const { verkey: publicKeyBase58 } = await this.wallet.createDid()

    const recipientKey = Key.fromPublicKeyBase58(publicKeyBase58, KeyType.Ed25519)

    let routing: Routing = {
      endpoints: this.agentConfig.endpoints,
      routingKeys: [],
      recipientKey,
    }

    // Extend routing with mediator keys (if applicable)
    routing = await this.mediationRecipientService.addMediationRouting(routing, {
      mediatorId,
      useDefaultMediator,
    })

    // Emit event so other parts of the framework can react on keys created
    this.eventEmitter.emit<RoutingCreatedEvent>({
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
