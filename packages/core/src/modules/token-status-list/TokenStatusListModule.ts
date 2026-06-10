import type { DependencyManager, Module } from '../../plugins'
import { TokenStatusListApi } from './TokenStatusListApi'
import { TokenStatusListService } from './TokenStatusListService'

/**
 * @public
 */
export class TokenStatusListModule implements Module {
  public readonly api = TokenStatusListApi

  /**
   * Registers the dependencies of the mdoc module on the dependency manager.
   */
  public register(dependencyManager: DependencyManager) {
    // Services
    dependencyManager.registerSingleton(TokenStatusListService)
  }
}
