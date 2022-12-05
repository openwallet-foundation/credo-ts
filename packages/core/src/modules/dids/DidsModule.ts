import type { DependencyManager, Module } from '../../plugins'
import type { DidsModuleConfigOptions } from './DidsModuleConfig'

import { DidsApi } from './DidsApi'
import { DidsModuleConfig } from './DidsModuleConfig'
import { DidResolverToken, DidRegistrarToken } from './domain'
import { DidRepository } from './repository'
import { DidResolverService, DidRegistrarService } from './services'

export class DidsModule implements Module {
  public readonly config: DidsModuleConfig

  public constructor(config?: DidsModuleConfigOptions) {
    this.config = new DidsModuleConfig(config)
  }

  public readonly api = DidsApi

  /**
   * Registers the dependencies of the dids module module on the dependency manager.
   */
  public register(dependencyManager: DependencyManager) {
    // Api
    dependencyManager.registerContextScoped(DidsApi)

    // Config
    dependencyManager.registerInstance(DidsModuleConfig, this.config)

    // Services
    dependencyManager.registerSingleton(DidResolverService)
    dependencyManager.registerSingleton(DidRegistrarService)
    dependencyManager.registerSingleton(DidRepository)

    // Register all did resolvers
    for (const Resolver of this.config.resolvers) {
      dependencyManager.registerSingleton(DidResolverToken, Resolver)
    }

    // Register all did registrars
    for (const Registrar of this.config.registrars) {
      dependencyManager.registerSingleton(DidRegistrarToken, Registrar)
    }
  }
}
