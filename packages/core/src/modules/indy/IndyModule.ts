import type { DependencyManager, Module } from '../../plugins'

import { IndyRevocationService, IndyUtilitiesService } from './services'
import { IndyHolderService } from './services/IndyHolderService'
import { IndyIssuerService } from './services/IndyIssuerService'
import { IndyVerifierService } from './services/IndyVerifierService'

export class IndyModule implements Module {
  public register(dependencyManager: DependencyManager) {
    dependencyManager.registerSingleton(IndyIssuerService)
    dependencyManager.registerSingleton(IndyHolderService)
    dependencyManager.registerSingleton(IndyVerifierService)
    dependencyManager.registerSingleton(IndyRevocationService)
    dependencyManager.registerSingleton(IndyUtilitiesService)
  }
}
