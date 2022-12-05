import type { FeatureRegistry } from '../../agent/FeatureRegistry'
import type { DependencyManager, Module } from '../../plugins'
import type { MediatorModuleConfigOptions } from './MediatorModuleConfig'

import { Protocol } from '../../agent/models'

import { MediatorApi } from './MediatorApi'
import { MediatorModuleConfig } from './MediatorModuleConfig'
import { MediationRole } from './models'
import {
  MediatorService,
  MediationRecipientService,
  MessagePickupService,
  V2MessagePickupService,
  V2MediationRecipientService,
  V2MediatorService,
  V3MessagePickupService,
} from './protocol'
import { RoutingService, V2RoutingService } from './protocol/routing'
import { MediationRepository, MediatorRoutingRepository } from './repository'
import { MediationService } from './services'

export class MediatorModule implements Module {
  public readonly config: MediatorModuleConfig
  public readonly api = MediatorApi

  public constructor(config?: MediatorModuleConfigOptions) {
    this.config = new MediatorModuleConfig(config)
  }

  /**
   * Registers the dependencies of the question answer module on the dependency manager.
   */
  public register(dependencyManager: DependencyManager, featureRegistry: FeatureRegistry) {
    // Api
    dependencyManager.registerContextScoped(MediatorApi)

    // Config
    dependencyManager.registerInstance(MediatorModuleConfig, this.config)

    // Services
    dependencyManager.registerSingleton(MediationService)

    // pickup
    dependencyManager.registerSingleton(MessagePickupService)
    dependencyManager.registerSingleton(V2MessagePickupService)
    dependencyManager.registerSingleton(V3MessagePickupService)

    // routing
    dependencyManager.registerSingleton(RoutingService)
    dependencyManager.registerSingleton(V2RoutingService)

    // coordinate-mediation
    dependencyManager.registerSingleton(MediationRecipientService)
    dependencyManager.registerSingleton(MediatorService)
    dependencyManager.registerSingleton(V2MediationRecipientService)
    dependencyManager.registerSingleton(V2MediatorService)

    // Repositories
    dependencyManager.registerSingleton(MediationRepository)
    dependencyManager.registerSingleton(MediatorRoutingRepository)

    // Features
    featureRegistry.register(
      new Protocol({
        id: 'https://didcomm.org/coordinate-mediation/1.0',
        roles: [MediationRole.Mediator],
      }),
      new Protocol({
        id: 'https://didcomm.org/coordinate-mediation/2.0',
        roles: [MediationRole.Mediator],
      }),
      new Protocol({
        id: 'https://didcomm.org/messagepickup/1.0',
        roles: ['message_holder', 'recipient', 'batch_sender', 'batch_recipient'],
      }),
      new Protocol({
        id: 'https://didcomm.org/messagepickup/2.0',
        roles: ['mediator', 'recipient'],
      }),
      new Protocol({
        id: 'https://didcomm.org/messagepickup/3.0',
        roles: ['mediator', 'recipient'],
      })
    )
  }
}
