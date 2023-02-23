import type { ProofsModuleConfigOptions } from './ProofsModuleConfig'
import type { ProofProtocol } from './protocol/ProofProtocol'
import type { FeatureRegistry } from '../../agent/FeatureRegistry'
import type { ApiModule, DependencyManager } from '../../plugins'
import type { Optional } from '../../utils'
import type { Constructor } from '../../utils/mixins'

import { ProofsApi } from './ProofsApi'
import { ProofsModuleConfig } from './ProofsModuleConfig'
import { V2ProofProtocol } from './protocol'
import { ProofRepository } from './repository'

/**
 * Default proofProtocols that will be registered if the `proofProtocols` property is not configured.
 */
export type DefaultProofProtocols = [V2ProofProtocol<[]>]

// ProofsModuleOptions makes the proofProtocols property optional from the config, as it will set it when not provided.
export type ProofsModuleOptions<ProofProtocols extends ProofProtocol[]> = Optional<
  ProofsModuleConfigOptions<ProofProtocols>,
  'proofProtocols'
>

export class ProofsModule<ProofProtocols extends ProofProtocol[] = DefaultProofProtocols> implements ApiModule {
  public readonly config: ProofsModuleConfig<ProofProtocols>

  public readonly api: Constructor<ProofsApi<ProofProtocols>> = ProofsApi

  public constructor(config?: ProofsModuleOptions<ProofProtocols>) {
    this.config = new ProofsModuleConfig({
      ...config,
      // NOTE: the proofProtocols defaults are set in the ProofsModule rather than the ProofsModuleConfig to
      // avoid dependency cycles.
      proofProtocols: config?.proofProtocols ?? [new V2ProofProtocol({ proofFormats: [] })],
    }) as ProofsModuleConfig<ProofProtocols>
  }

  /**
   * Registers the dependencies of the proofs module on the dependency manager.
   */
  public register(dependencyManager: DependencyManager, featureRegistry: FeatureRegistry) {
    // Api
    dependencyManager.registerContextScoped(ProofsApi)

    // Config
    dependencyManager.registerInstance(ProofsModuleConfig, this.config)

    // Repositories
    dependencyManager.registerSingleton(ProofRepository)

    for (const proofProtocol of this.config.proofProtocols) {
      proofProtocol.register(dependencyManager, featureRegistry)
    }
  }
}
