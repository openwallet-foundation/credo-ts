import type { AgentContext, ApiModule, Constructor, DependencyManager, Optional } from '@credo-ts/core'
import type { DidCommProofsModuleConfigOptions } from './DidCommProofsModuleConfig'
import type { DidCommProofProtocol } from './protocol/DidCommProofProtocol'

import { DidCommFeatureRegistry } from '../../DidCommFeatureRegistry'
import { DidCommMessageHandlerRegistry } from '../../DidCommMessageHandlerRegistry'

import { DidCommProofsApi } from './DidCommProofsApi'
import { DidCommProofsModuleConfig } from './DidCommProofsModuleConfig'
import { V2DidCommProofProtocol } from './protocol'
import { DidCommProofExchangeRepository } from './repository'

/**
 * Default proofProtocols that will be registered if the `proofProtocols` property is not configured.
 */
export type DefaultDidCommProofProtocols = [V2DidCommProofProtocol<[]>]

// ProofsModuleOptions makes the proofProtocols property optional from the config, as it will set it when not provided.
export type DidCommProofsModuleOptions<ProofProtocols extends DidCommProofProtocol[]> = Optional<
  DidCommProofsModuleConfigOptions<ProofProtocols>,
  'proofProtocols'
>

export class DidCommProofsModule<ProofProtocols extends DidCommProofProtocol[] = DefaultDidCommProofProtocols> implements ApiModule {
  public readonly config: DidCommProofsModuleConfig<ProofProtocols>

  public readonly api: Constructor<DidCommProofsApi<ProofProtocols>> = DidCommProofsApi

  public constructor(config?: DidCommProofsModuleOptions<ProofProtocols>) {
    this.config = new DidCommProofsModuleConfig({
      ...config,
      // NOTE: the proofProtocols defaults are set in the DidCommProofsModule rather than the ProofsModuleConfig to
      // avoid dependency cycles.
      proofProtocols: config?.proofProtocols ?? [new V2DidCommProofProtocol({ proofFormats: [] })],
    }) as DidCommProofsModuleConfig<ProofProtocols>
  }

  /**
   * Registers the dependencies of the proofs module on the dependency manager.
   */
  public register(dependencyManager: DependencyManager) {
    // Config
    dependencyManager.registerInstance(DidCommProofsModuleConfig, this.config)

    // Repositories
    dependencyManager.registerSingleton(DidCommProofExchangeRepository)
  }

  public async initialize(agentContext: AgentContext): Promise<void> {
    const messageHandlerRegistry = agentContext.dependencyManager.resolve(DidCommMessageHandlerRegistry)
    const featureRegistry = agentContext.dependencyManager.resolve(DidCommFeatureRegistry)
    for (const proofProtocol of this.config.proofProtocols) {
      proofProtocol.register(messageHandlerRegistry, featureRegistry)
    }
  }
}
