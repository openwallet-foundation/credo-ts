import type { DependencyManager } from '../../plugins'

import { module } from '../../plugins'

import { CredentialsApi } from './CredentialsApi'
import { CredentialsModuleConfig, CredentialsModuleConfigOptions } from './CredentialsModuleConfig'
import { IndyCredentialFormatService } from './formats/indy'
import { RevocationNotificationService } from './protocol/revocation-notification/services'
import { V1CredentialService } from './protocol/v1'
import { V2CredentialService } from './protocol/v2'
import { CredentialRepository } from './repository'

@module()
export class CredentialsModule {
  public readonly config: CredentialsModuleConfig

  public constructor(config: CredentialsModuleConfigOptions) {
    this.config = new CredentialsModuleConfig(config)
  }

  /**
   * Registers the dependencies of the credentials module on the dependency manager.
   */
  public register(dependencyManager: DependencyManager) {
    // Api
    dependencyManager.registerContextScoped(CredentialsApi)

    // Services
    dependencyManager.registerSingleton(V1CredentialService)
    dependencyManager.registerSingleton(RevocationNotificationService)
    dependencyManager.registerSingleton(V2CredentialService)

    // Repositories
    dependencyManager.registerSingleton(CredentialRepository)

    // Credential Formats
    dependencyManager.registerSingleton(IndyCredentialFormatService)
  }
}
