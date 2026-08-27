import type { DependencyManager, Module } from '../../plugins'
import { injectable } from '../../plugins'
import { W3cV2DataIntegrityContextValidator, W3cV2DataIntegrityCredentialService } from './data-integrity'
import { W3cV2JwtCredentialService } from './jwt-vc'
import { SignatureSuiteRegistry } from './linked-data-proofs/SignatureSuiteRegistry'
import { W3cV2CredentialRepository } from './repository/W3cV2CredentialRepository'
import { W3cV2SdJwtCredentialService } from './sd-jwt-vc'
import { W3cV2CredentialService } from './W3cV2CredentialService'
import { W3cV2CredentialsApi } from './W3cV2CredentialsApi'
import type { W3cV2CredentialsModuleConfigOptions } from './W3cV2CredentialsModuleConfig'
import { W3cV2CredentialsModuleConfig } from './W3cV2CredentialsModuleConfig'

/**
 * @public
 */
@injectable()
export class W3cV2CredentialsModule implements Module {
  public readonly api = W3cV2CredentialsApi
  public readonly config: W3cV2CredentialsModuleConfig

  public constructor(options?: W3cV2CredentialsModuleConfigOptions) {
    this.config = new W3cV2CredentialsModuleConfig(options)
  }

  public register(dependencyManager: DependencyManager) {
    // Linked-data-proofs infrastructure
    dependencyManager.registerSingleton(SignatureSuiteRegistry)

    // VC DI context validator (owned at VC layer, not core DI layer)
    dependencyManager.registerInstance(
      W3cV2DataIntegrityContextValidator,
      new W3cV2DataIntegrityContextValidator({
        recompactInvalidContexts: this.config.recompactInvalidContexts,
      })
    )
    dependencyManager.registerInstance(W3cV2CredentialsModuleConfig, this.config)
    // VC services
    dependencyManager.registerSingleton(W3cV2CredentialService)
    dependencyManager.registerSingleton(W3cV2DataIntegrityCredentialService)
    dependencyManager.registerSingleton(W3cV2JwtCredentialService)
    dependencyManager.registerSingleton(W3cV2SdJwtCredentialService)
    dependencyManager.registerSingleton(W3cV2CredentialRepository)
  }
}
