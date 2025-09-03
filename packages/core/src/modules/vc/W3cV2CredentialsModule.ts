import type { DependencyManager, Module } from '../../plugins'
import {
  VERIFICATION_METHOD_TYPE_ED25519_VERIFICATION_KEY_2018,
  VERIFICATION_METHOD_TYPE_ED25519_VERIFICATION_KEY_2020,
} from '../dids'
import { Ed25519PublicJwk } from '../kms'
import { W3cV2CredentialService } from './W3cV2CredentialService'
import { W3cV2CredentialsApi } from './W3cV2CredentialsApi'
import type { W3cV2CredentialsModuleConfigOptions } from './W3cV2CredentialsModuleConfig'
import { W3cV2CredentialsModuleConfig } from './W3cV2CredentialsModuleConfig'
import { SignatureSuiteRegistry, SignatureSuiteToken, SuiteInfo } from './data-integrity/SignatureSuiteRegistry'
import { Ed25519Signature2018, Ed25519Signature2020 } from './data-integrity/signature-suites'
import { W3cV2JwtCredentialService } from './jwt-vc'
import { W3cV2CredentialRepository } from './repository/W3cV2CredentialRepository'
import { W3cV2SdJwtCredentialService } from './sd-jwt-vc'

/**
 * @public
 */
export class W3cV2CredentialsModule implements Module {
  public readonly config: W3cV2CredentialsModuleConfig
  public readonly api = W3cV2CredentialsApi

  public constructor(config?: W3cV2CredentialsModuleConfigOptions) {
    this.config = new W3cV2CredentialsModuleConfig(config)
  }

  public register(dependencyManager: DependencyManager) {
    dependencyManager.registerSingleton(W3cV2CredentialService)
    dependencyManager.registerSingleton(W3cV2JwtCredentialService)
    dependencyManager.registerSingleton(W3cV2SdJwtCredentialService)
    dependencyManager.registerSingleton(W3cV2CredentialRepository)

    dependencyManager.registerSingleton(SignatureSuiteRegistry)

    // Register the config
    dependencyManager.registerInstance(W3cV2CredentialsModuleConfig, this.config)

    // Always register ed25519 signature suite
    dependencyManager.registerInstance(SignatureSuiteToken, {
      suiteClass: Ed25519Signature2018,
      proofType: 'Ed25519Signature2018',
      verificationMethodTypes: [
        VERIFICATION_METHOD_TYPE_ED25519_VERIFICATION_KEY_2018,
        VERIFICATION_METHOD_TYPE_ED25519_VERIFICATION_KEY_2020,
      ],
      supportedPublicJwkTypes: [Ed25519PublicJwk],
    } satisfies SuiteInfo)
    dependencyManager.registerInstance(SignatureSuiteToken, {
      suiteClass: Ed25519Signature2020,
      proofType: 'Ed25519Signature2020',
      verificationMethodTypes: [VERIFICATION_METHOD_TYPE_ED25519_VERIFICATION_KEY_2020],
      supportedPublicJwkTypes: [Ed25519PublicJwk],
    } satisfies SuiteInfo)
  }
}
