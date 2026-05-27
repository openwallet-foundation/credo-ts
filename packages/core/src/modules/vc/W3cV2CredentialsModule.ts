import type { DependencyManager, Module } from '../../plugins'
import { W3cV2JwtCredentialService } from './jwt-vc'
import { SignatureSuiteRegistry } from './linked-data-proofs/SignatureSuiteRegistry'
import { W3cV2CredentialRepository } from './repository/W3cV2CredentialRepository'
import { W3cV2SdJwtCredentialService } from './sd-jwt-vc'
import { W3cV2CredentialService } from './W3cV2CredentialService'
import { W3cV2CredentialsApi } from './W3cV2CredentialsApi'

export interface W3cV2CredentialsModuleConfigOptions {
  /**
   * Placeholder flag for future Data Integrity component wiring.
   *
   * This branch only supports DI stubs and intentionally does not register
   * vc/data-integrity-v1 or w3c-di implementations.
   */
  enableDataIntegrityStubs?: boolean
}

/**
 * @public
 */
export class W3cV2CredentialsModule implements Module {
  public readonly api = W3cV2CredentialsApi
  public readonly options: Readonly<Required<W3cV2CredentialsModuleConfigOptions>>

  public constructor(options?: W3cV2CredentialsModuleConfigOptions) {
    this.options = {
      enableDataIntegrityStubs: options?.enableDataIntegrityStubs ?? true,
    }
  }

  public register(dependencyManager: DependencyManager) {
    dependencyManager.registerSingleton(W3cV2CredentialService)
    dependencyManager.registerSingleton(W3cV2JwtCredentialService)
    dependencyManager.registerSingleton(W3cV2SdJwtCredentialService)
    dependencyManager.registerSingleton(W3cV2CredentialRepository)
    dependencyManager.registerSingleton(SignatureSuiteRegistry)
  }
}
