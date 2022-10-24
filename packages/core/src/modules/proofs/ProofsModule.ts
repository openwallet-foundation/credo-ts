import type { FeatureRegistry } from '../../agent/FeatureRegistry'
import type { DependencyManager, Module } from '../../plugins'
import type { ProofsModuleConfigOptions } from './ProofsModuleConfig'

import { Protocol } from '../../agent/models'

import { ProofsApi } from './ProofsApi'
import { ProofsModuleConfig } from './ProofsModuleConfig'
import { IndyProofFormatService } from './formats/indy/IndyProofFormatService'
import { V1ProofService } from './protocol/v1'
import { V2ProofService } from './protocol/v2'
import { ProofRepository } from './repository'

export class ProofsModule implements Module {
  public readonly config: ProofsModuleConfig
  public readonly api = ProofsApi

  public constructor(config?: ProofsModuleConfigOptions) {
    this.config = new ProofsModuleConfig(config)
  }

  /**
   * Registers the dependencies of the proofs module on the dependency manager.
   */
  public register(dependencyManager: DependencyManager, featureRegistry: FeatureRegistry) {
    // Api
    dependencyManager.registerContextScoped(ProofsApi)

    // Config
    dependencyManager.registerInstance(ProofsModuleConfig, this.config)

    // Services
    dependencyManager.registerSingleton(V1ProofService)
    dependencyManager.registerSingleton(V2ProofService)

    // Repositories
    dependencyManager.registerSingleton(ProofRepository)

    // Proof Formats
    dependencyManager.registerSingleton(IndyProofFormatService)

    // Features
    featureRegistry.register(
      new Protocol({
        id: 'https://didcomm.org/present-proof/1.0',
        roles: ['verifier', 'prover'],
      })
    )
  }
}
