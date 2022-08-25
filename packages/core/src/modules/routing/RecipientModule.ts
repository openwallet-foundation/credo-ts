import type { DependencyManager, Module } from '../../plugins'
import type { FeatureRegistry } from '../discover-features'
import type { RecipientModuleConfigOptions } from './RecipientModuleConfig'

import { Protocol } from '../discover-features'

import { RecipientApi } from './RecipientApi'
import { RecipientModuleConfig } from './RecipientModuleConfig'
import { MediationRole } from './models'
import { MediationRepository } from './repository'
import { MediationRecipientService, RoutingService } from './services'

export class RecipientModule implements Module {
  public readonly config: RecipientModuleConfig

  public constructor(config?: RecipientModuleConfigOptions) {
    this.config = new RecipientModuleConfig(config)
  }

  /**
   * Registers the dependencies of the mediator recipient module on the dependency manager.
   */
  public register(featureRegistry: FeatureRegistry, dependencyManager: DependencyManager) {
    // Api
    dependencyManager.registerContextScoped(RecipientApi)

    // Config
    dependencyManager.registerInstance(RecipientModuleConfig, this.config)

    // Services
    dependencyManager.registerSingleton(MediationRecipientService)
    dependencyManager.registerSingleton(RoutingService)

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
