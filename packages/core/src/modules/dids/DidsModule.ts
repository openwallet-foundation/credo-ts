import type { DependencyManager, Module } from '../../plugins'
import { DidsApi } from './DidsApi'
import type { DidsModuleConfigOptions } from './DidsModuleConfig'
import { DidsModuleConfig } from './DidsModuleConfig'
import { DidRepository } from './repository'
import { DidRegistrarService, DidResolverService } from './services'

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
    // Config
    dependencyManager.registerInstance(DidsModuleConfig, this.config)

    // Services
    dependencyManager.registerSingleton(DidResolverService)
    dependencyManager.registerSingleton(DidRegistrarService)
    dependencyManager.registerSingleton(DidRepository)
  }
}
