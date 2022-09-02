import type { DependencyManager, Module } from '../../plugins'
import type { FeatureRegistry } from '../discover-features'
import type { CredentialsModuleConfigOptions } from './CredentialsModuleConfig'

import { Protocol } from '../discover-features'

import { CredentialsApi } from './CredentialsApi'
import { CredentialsModuleConfig } from './CredentialsModuleConfig'
import { IndyCredentialFormatService } from './formats/indy'
import { RevocationNotificationService } from './protocol/revocation-notification/services'
import { V1CredentialService } from './protocol/v1'
import { V2CredentialService } from './protocol/v2'
import { CredentialRepository } from './repository'

export class CredentialsModule implements Module {
  public readonly config: CredentialsModuleConfig

  public constructor(config?: CredentialsModuleConfigOptions) {
    this.config = new CredentialsModuleConfig(config)
  }

  /**
   * Registers the dependencies of the credentials module on the dependency manager.
   */
  public register(featureRegistry: FeatureRegistry, dependencyManager: DependencyManager) {
    // Api
    dependencyManager.registerContextScoped(CredentialsApi)

    // Config
    dependencyManager.registerInstance(CredentialsModuleConfig, this.config)

    // Services
    dependencyManager.registerSingleton(V1CredentialService)
    dependencyManager.registerSingleton(RevocationNotificationService)
    dependencyManager.registerSingleton(V2CredentialService)

    // Repositories
    dependencyManager.registerSingleton(CredentialRepository)

    // Features
    featureRegistry.register(
      new Protocol({
        id: 'https://didcomm.org/issue-credential/1.0',
        roles: ['holder', 'issuer'],
      }),
      new Protocol({
        id: 'https://didcomm.org/issue-credential/2.0',
        roles: ['holder', 'issuer'],
      }),
      new Protocol({
        id: 'https://didcomm.org/revocation_notification/1.0',
        roles: ['holder'],
      }),
      new Protocol({
        id: 'https://didcomm.org/revocation_notification/2.0',
        roles: ['holder'],
      })
    )

    // Credential Formats
    dependencyManager.registerSingleton(IndyCredentialFormatService)
  }
}
