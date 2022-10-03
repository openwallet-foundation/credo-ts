import type { DependencyManager } from '../../plugins'

import { injectable, module } from '../../plugins'

import { KeyRepository } from './repository'
import { KeyService } from './services/KeyService'

@module()
@injectable()
export class KeysModule {
  private keyService: KeyService

  public constructor(keyService: KeyService) {
    this.keyService = keyService
  }

  /**
   * Registers the dependencies of the keys module on the dependency manager.
   */
  public static register(dependencyManager: DependencyManager) {
    // Api
    dependencyManager.registerContextScoped(KeysModule)

    // Services
    dependencyManager.registerSingleton(KeyService)

    // Repositories
    dependencyManager.registerSingleton(KeyRepository)
  }
}
