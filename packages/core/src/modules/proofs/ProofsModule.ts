import type { DependencyManager, Module } from '../../plugins'
import type { ProofsModuleConfigOptions } from './ProofsModuleConfig'

import { ProofsApi } from './ProofsApi'
import { ProofsModuleConfig } from './ProofsModuleConfig'
import { ProofRepository } from './repository'
import { ProofService } from './services'

export class ProofsModule implements Module {
  public readonly config: ProofsModuleConfig

  public constructor(config?: ProofsModuleConfigOptions) {
    this.config = new ProofsModuleConfig(config)
  }

  /**
   * Registers the dependencies of the proofs module on the dependency manager.
   */
  public register(dependencyManager: DependencyManager) {
    // Api
    dependencyManager.registerContextScoped(ProofsApi)

    // Config
    dependencyManager.registerInstance(ProofsModuleConfig, this.config)

    // Services
    dependencyManager.registerSingleton(ProofService)

    // Repositories
    dependencyManager.registerSingleton(ProofRepository)
  }
}
