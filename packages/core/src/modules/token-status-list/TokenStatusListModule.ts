import type { DependencyManager, Module } from '../../plugins'
import { TokenStatusListApi } from './TokenStatusListApi'
import { TokenStatusListModuleConfig, type TokenStatusListModuleConfigOptions } from './TokenStatusListModuleConfig'
import { TokenStatusListService } from './TokenStatusListService'

/**
 * @public
 */
export class TokenStatusListModule implements Module {
  public readonly config: TokenStatusListModuleConfig

  public readonly api = TokenStatusListApi

  public constructor(options?: TokenStatusListModuleConfigOptions) {
    this.config = new TokenStatusListModuleConfig(options)
  }

  /**
   * Registers the dependencies of the mdoc module on the dependency manager.
   */
  public register(dependencyManager: DependencyManager) {
    // Config
    dependencyManager.registerInstance(TokenStatusListModuleConfig, this.config)

    // Services
    dependencyManager.registerSingleton(TokenStatusListService)
  }
}
