import type { DependencyManager, Module } from '../../plugins'
import type { MediatorModuleConfigOptions } from './MediatorModuleConfig'

import { MediatorApi } from './MediatorApi'
import { MediatorModuleConfig } from './MediatorModuleConfig'
import { MediationRepository, MediatorRoutingRepository } from './repository'
import { MediatorService, MessagePickupService } from './services'

export class MediatorModule implements Module {
  public readonly config: MediatorModuleConfig

  public constructor(config?: MediatorModuleConfigOptions) {
    this.config = new MediatorModuleConfig(config)
  }

  /**
   * Registers the dependencies of the question answer module on the dependency manager.
   */
  public register(dependencyManager: DependencyManager) {
    // Api
    dependencyManager.registerContextScoped(MediatorApi)

    // Config
    dependencyManager.registerInstance(MediatorModuleConfig, this.config)

    // Services
    dependencyManager.registerSingleton(MediatorService)
    dependencyManager.registerSingleton(MessagePickupService)

    // Repositories
    dependencyManager.registerSingleton(MediationRepository)
    dependencyManager.registerSingleton(MediatorRoutingRepository)
  }
}
