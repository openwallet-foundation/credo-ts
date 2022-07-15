import type { DependencyManager, Module } from '../../plugins'

import { W3cCredentialService } from './W3cCredentialService'
import { W3cCredentialRepository } from './repository/W3cCredentialRepository'

export class W3cVcModule implements Module {
  public register(dependencyManager: DependencyManager) {
    dependencyManager.registerSingleton(W3cCredentialService)
    dependencyManager.registerSingleton(W3cCredentialRepository)
  }
}
