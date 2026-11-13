import type { AgentContext, ApiModule, Constructor, DependencyManager, Optional } from '@credo-ts/core'
import { DidCommFeatureRegistry } from '../../DidCommFeatureRegistry'
import { DidCommMessageHandlerRegistry } from '../../DidCommMessageHandlerRegistry'
import { DidCommCredentialsApi } from './DidCommCredentialsApi'
import type { DidCommCredentialsModuleConfigOptions } from './DidCommCredentialsModuleConfig'
import { DidCommCredentialsModuleConfig } from './DidCommCredentialsModuleConfig'
import type { DidCommCredentialProtocol } from './protocol/DidCommCredentialProtocol'
import { DidCommCredentialV2Protocol } from './protocol/v2'
import { DidCommCredentialExchangeRepository } from './repository'

/**
 * Default credentialProtocols that will be registered if the `credentialProtocols` property is not configured.
 */
export type DefaultDidCommCredentialProtocols = [DidCommCredentialV2Protocol<[]>]

// CredentialsModuleOptions makes the credentialProtocols property optional from the config, as it will set it when not provided.
export type DidCommCredentialsModuleOptions<CredentialProtocols extends DidCommCredentialProtocol[]> = Optional<
  DidCommCredentialsModuleConfigOptions<CredentialProtocols>,
  'credentialProtocols'
>

export class DidCommCredentialsModule<
  CredentialProtocols extends DidCommCredentialProtocol[] = DefaultDidCommCredentialProtocols,
> implements ApiModule
{
  public readonly config: DidCommCredentialsModuleConfig<CredentialProtocols>

  // Infer Api type from the config
  public readonly api: Constructor<DidCommCredentialsApi<CredentialProtocols>> = DidCommCredentialsApi

  public constructor(config?: DidCommCredentialsModuleOptions<CredentialProtocols>) {
    this.config = new DidCommCredentialsModuleConfig({
      ...config,
      // NOTE: the credentialProtocols defaults are set in the CredentialsModule rather than the CredentialsModuleConfig to
      // avoid dependency cycles.
      credentialProtocols: config?.credentialProtocols ?? [new DidCommCredentialV2Protocol({ credentialFormats: [] })],
    }) as DidCommCredentialsModuleConfig<CredentialProtocols>
  }

  /**
   * Registers the dependencies of the credentials module on the dependency manager.
   */
  public register(dependencyManager: DependencyManager) {
    // Config
    dependencyManager.registerInstance(DidCommCredentialsModuleConfig, this.config)

    // Repositories
    dependencyManager.registerSingleton(DidCommCredentialExchangeRepository)
  }

  public async initialize(agentContext: AgentContext): Promise<void> {
    const messageHandlerRegistry = agentContext.dependencyManager.resolve(DidCommMessageHandlerRegistry)
    const featureRegistry = agentContext.dependencyManager.resolve(DidCommFeatureRegistry)

    // Protocol needs to register feature registry items and handlers
    for (const credentialProtocol of this.config.credentialProtocols) {
      credentialProtocol.register(messageHandlerRegistry, featureRegistry)
    }
  }
}
