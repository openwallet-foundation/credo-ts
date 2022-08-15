import type { DependencyManager, Module } from '../../plugins'

import { RevocationNotificationService } from '../credentials/protocol/revocation-notification/services'

import { ProofsApi } from './ProofsApi'
import { IndyProofFormatService } from './formats/indy/IndyProofFormatService'
import { V1ProofService } from './protocol/v1'
import { V2ProofService } from './protocol/v2'
import { ProofRepository } from './repository'

export class ProofsModule implements Module {
  /**
   * Registers the dependencies of the credentials module on the dependency manager.
   */
  public register(dependencyManager: DependencyManager) {
    // Api
    dependencyManager.registerContextScoped(ProofsApi)

    // Services
    dependencyManager.registerSingleton(V1ProofService)
    dependencyManager.registerSingleton(RevocationNotificationService)
    dependencyManager.registerSingleton(V2ProofService)

    // Repositories
    dependencyManager.registerSingleton(ProofRepository)

    // Credential Formats
    dependencyManager.registerSingleton(IndyProofFormatService)
  }
}
