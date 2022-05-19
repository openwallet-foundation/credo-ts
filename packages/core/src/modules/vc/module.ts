import type { DependencyManager } from '../../plugins'

import { module } from '../../plugins'

import { W3cCredentialService } from './W3cCredentialService'
import { W3cCredentialRepository } from './repository/W3cCredentialRepository'

@module()
export class W3cVcModule {
  public static register(dependencyManager: DependencyManager) {
    dependencyManager.registerSingleton(W3cCredentialService)
    dependencyManager.registerSingleton(W3cCredentialRepository)
  }
}
