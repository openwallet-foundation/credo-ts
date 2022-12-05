import type { FeatureRegistry } from '../../agent/FeatureRegistry'
import type { DependencyManager, Module } from '../../plugins'
import type { RecipientModuleConfigOptions } from './RecipientModuleConfig'

import { Protocol } from '../../agent/models'

import { RecipientApi } from './RecipientApi'
import { RecipientModuleConfig } from './RecipientModuleConfig'
import { MediationRole } from './models'
import {
  MediationRecipientService,
  MediatorService,
  MessagePickupService,
  RoutingService,
  V2MediationRecipientService,
  V2MediatorService,
  V2MessagePickupService,
  V2RoutingService,
  V3MessagePickupService,
} from './protocol'
import { MediationRepository } from './repository'
import { MediationService } from './services'

export class RecipientModule implements Module {
  public readonly config: RecipientModuleConfig
  public readonly api = RecipientApi

  public constructor(config?: RecipientModuleConfigOptions) {
    this.config = new RecipientModuleConfig(config)
  }

  /**
   * Registers the dependencies of the mediator recipient module on the dependency manager.
   */
  public register(dependencyManager: DependencyManager, featureRegistry: FeatureRegistry) {
    // Api
    dependencyManager.registerContextScoped(RecipientApi)

    // Config
    dependencyManager.registerInstance(RecipientModuleConfig, this.config)

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

    // Features
    featureRegistry.register(
      new Protocol({
        id: 'https://didcomm.org/coordinate-mediation/1.0',
        roles: [MediationRole.Recipient],
      })
    )
  }
}
