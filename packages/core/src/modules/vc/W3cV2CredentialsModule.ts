import type { DependencyManager, Module } from '../../plugins'
import { injectable } from '../../plugins'
import { CREDENTIALS_CONTEXT_V2_URL } from './constants'
import { W3cV2DataIntegrityContextValidator, W3cV2DataIntegrityCredentialService } from './data-integrity-v1'
import { W3cV2JwtCredentialService } from './jwt-vc'
import { SignatureSuiteRegistry } from './linked-data-proofs/SignatureSuiteRegistry'
import { W3cV2CredentialRepository } from './repository/W3cV2CredentialRepository'
import { W3cV2SdJwtCredentialService } from './sd-jwt-vc'
import { W3cV2CredentialService } from './W3cV2CredentialService'
import { W3cV2CredentialsApi } from './W3cV2CredentialsApi'

export interface W3cV2CredentialsModuleConfigOptions {
  dataIntegrity?: {
    knownContexts?: unknown[]
    recompactInvalidContexts?: boolean
  }
}

/**
 * @public
 */
@injectable()
export class W3cV2CredentialsModule implements Module {
  public readonly api = W3cV2CredentialsApi
  private options: W3cV2CredentialsModuleConfigOptions

  public constructor(options?: W3cV2CredentialsModuleConfigOptions) {
    this.options = options ?? {}
  }

  public register(dependencyManager: DependencyManager) {
    // Linked-data-proofs infrastructure
    dependencyManager.registerSingleton(SignatureSuiteRegistry)

    // VC DI context validator (owned at VC layer, not core DI layer)
    dependencyManager.registerInstance(
      W3cV2DataIntegrityContextValidator,
      new W3cV2DataIntegrityContextValidator().configure({
        knownContext: this.options.dataIntegrity?.knownContexts ?? [CREDENTIALS_CONTEXT_V2_URL],
        recompactInvalidContexts: this.options.dataIntegrity?.recompactInvalidContexts ?? true,
      })
    )
    // VC services
    dependencyManager.registerSingleton(W3cV2CredentialService)
    dependencyManager.registerSingleton(W3cV2DataIntegrityCredentialService)
    dependencyManager.registerSingleton(W3cV2JwtCredentialService)
    dependencyManager.registerSingleton(W3cV2SdJwtCredentialService)
    dependencyManager.registerSingleton(W3cV2CredentialRepository)
  }
}
