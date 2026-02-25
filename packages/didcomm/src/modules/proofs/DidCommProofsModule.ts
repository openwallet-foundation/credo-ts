import type { AgentContext, ApiModule, Constructor, DependencyManager, Optional } from '@credo-ts/core'
import { DidCommFeatureRegistry } from '../../DidCommFeatureRegistry'
import { DidCommMessageHandlerRegistry } from '../../DidCommMessageHandlerRegistry'
import { DidCommProofsApi } from './DidCommProofsApi'
import type { DidCommProofsModuleConfigOptions } from './DidCommProofsModuleConfig'
import { DidCommProofsModuleConfig } from './DidCommProofsModuleConfig'
import { DidCommProofV2Protocol } from './protocol'
import type { DidCommProofProtocol } from './protocol/DidCommProofProtocol'
import { DidCommProofExchangeRepository } from './repository'

/**
 * Default proofProtocols that will be registered if the `proofProtocols` property is not configured.
 */
export type DefaultDidCommProofProtocols = [DidCommProofV2Protocol<[]>]

// ProofsModuleOptions makes the proofProtocols property optional from the config, as it will set it when not provided.
export type DidCommProofsModuleOptions<ProofProtocols extends DidCommProofProtocol[]> = Optional<
  DidCommProofsModuleConfigOptions<ProofProtocols>,
  'proofProtocols'
>

export class DidCommProofsModule<ProofProtocols extends DidCommProofProtocol[] = DefaultDidCommProofProtocols>
  implements ApiModule
{
  public readonly config: DidCommProofsModuleConfig<ProofProtocols>

  public readonly api: Constructor<DidCommProofsApi<ProofProtocols>> = DidCommProofsApi

  public constructor(config?: DidCommProofsModuleOptions<ProofProtocols>) {
    this.config = new DidCommProofsModuleConfig({
      ...config,
      // NOTE: the proofProtocols defaults are set in the DidCommProofsModule rather than the ProofsModuleConfig to
      // avoid dependency cycles.
      proofProtocols: config?.proofProtocols ?? [new DidCommProofV2Protocol({ proofFormats: [] })],
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

      if (proofProtocol.constructor.name === 'DidCommCredentialV1Protocol') {
        agentContext.config.logger.debug(
          "The 'DidCommCredentialV1Protocol' is deprecated and will be removed in version 0.7 of Credo. You should upgrade to the 'DidCommCredentialV2Protocol' instead."
        )
      }
    }
  }
}
