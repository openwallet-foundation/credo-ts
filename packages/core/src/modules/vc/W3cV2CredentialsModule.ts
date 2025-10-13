import type { DependencyManager, Module } from '../../plugins'
import { SignatureSuiteRegistry } from './data-integrity/SignatureSuiteRegistry'
import { W3cV2JwtCredentialService } from './jwt-vc'
import { W3cV2CredentialRepository } from './repository/W3cV2CredentialRepository'
import { W3cV2SdJwtCredentialService } from './sd-jwt-vc'
import { W3cV2CredentialService } from './W3cV2CredentialService'
import { W3cV2CredentialsApi } from './W3cV2CredentialsApi'

/**
 * @public
 */
export class W3cV2CredentialsModule implements Module {
  public readonly api = W3cV2CredentialsApi

  public register(dependencyManager: DependencyManager) {
    dependencyManager.registerSingleton(W3cV2CredentialService)
    dependencyManager.registerSingleton(W3cV2JwtCredentialService)
    dependencyManager.registerSingleton(W3cV2SdJwtCredentialService)
    dependencyManager.registerSingleton(W3cV2CredentialRepository)
    dependencyManager.registerSingleton(SignatureSuiteRegistry)
  }
}
