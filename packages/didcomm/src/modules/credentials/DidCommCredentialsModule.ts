import type { AgentContext, ApiModule, Constructor, DependencyManager, Optional } from '@credo-ts/core'
import type { DidCommCredentialsModuleConfigOptions } from './DidCommCredentialsModuleConfig'
import type { DidCommCredentialProtocol } from './protocol/DidCommCredentialProtocol'

import { DidCommFeatureRegistry } from '../../DidCommFeatureRegistry'
import { DidCommMessageHandlerRegistry } from '../../DidCommMessageHandlerRegistry'
import { DidCommProtocol } from '../../models'

import { DidCommCredentialsApi } from './DidCommCredentialsApi'
import { DidCommCredentialsModuleConfig } from './DidCommCredentialsModuleConfig'
import { DidCommRevocationNotificationService } from './protocol/revocation-notification/services'
import { V2DidCommCredentialProtocol } from './protocol/v2'
import { DidCommCredentialExchangeRepository } from './repository'

/**
 * Default credentialProtocols that will be registered if the `credentialProtocols` property is not configured.
 */
export type DefaultCredentialProtocols = []

// CredentialsModuleOptions makes the credentialProtocols property optional from the config, as it will set it when not provided.
export type DidCommCredentialsModuleOptions<CredentialProtocols extends DidCommCredentialProtocol[]> = Optional<
  DidCommCredentialsModuleConfigOptions<CredentialProtocols>,
  'credentialProtocols'
>

export class DidCommCredentialsModule<CredentialProtocols extends DidCommCredentialProtocol[] = DefaultCredentialProtocols>
  implements ApiModule
{
  public readonly config: DidCommCredentialsModuleConfig<CredentialProtocols>

  // Infer Api type from the config
  public readonly api: Constructor<DidCommCredentialsApi<CredentialProtocols>> = DidCommCredentialsApi

  public constructor(config?: DidCommCredentialsModuleOptions<CredentialProtocols>) {
    this.config = new DidCommCredentialsModuleConfig({
      ...config,
      // NOTE: the credentialProtocols defaults are set in the CredentialsModule rather than the CredentialsModuleConfig to
      // avoid dependency cycles.
      credentialProtocols: config?.credentialProtocols ?? [new V2DidCommCredentialProtocol({ credentialFormats: [] })],
    }) as DidCommCredentialsModuleConfig<CredentialProtocols>
  }

  /**
   * Registers the dependencies of the credentials module on the dependency manager.
   */
  public register(dependencyManager: DependencyManager) {
    // Config
    dependencyManager.registerInstance(DidCommCredentialsModuleConfig, this.config)

    // Services
    dependencyManager.registerSingleton(DidCommRevocationNotificationService)

    // Repositories
    dependencyManager.registerSingleton(DidCommCredentialExchangeRepository)
  }

  public async initialize(agentContext: AgentContext): Promise<void> {
    const messageHandlerRegistry = agentContext.dependencyManager.resolve(DidCommMessageHandlerRegistry)
    const featureRegistry = agentContext.dependencyManager.resolve(DidCommFeatureRegistry)

    featureRegistry.register(
      new DidCommProtocol({
        id: 'https://didcomm.org/revocation_notification/1.0',
        roles: ['holder'],
      }),
      new DidCommProtocol({
        id: 'https://didcomm.org/revocation_notification/2.0',
        roles: ['holder'],
      })
    )

    // Protocol needs to register feature registry items and handlers
    for (const credentialProtocol of this.config.credentialProtocols) {
      credentialProtocol.register(messageHandlerRegistry, featureRegistry)
    }
  }
}
