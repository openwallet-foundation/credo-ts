import type { DependencyManager, Module } from '../../plugins'
import {
  VERIFICATION_METHOD_TYPE_ED25519_VERIFICATION_KEY_2018,
  VERIFICATION_METHOD_TYPE_ED25519_VERIFICATION_KEY_2020,
} from '../dids'
import type { W3cCredentialsModuleConfigOptions } from './W3cCredentialsModuleConfig'

import { Ed25519PublicJwk } from '../kms'
import { W3cCredentialService } from './W3cCredentialService'
import { W3cCredentialsApi } from './W3cCredentialsApi'
import { W3cCredentialsModuleConfig } from './W3cCredentialsModuleConfig'
import { SignatureSuiteRegistry, SignatureSuiteToken, SuiteInfo } from './data-integrity/SignatureSuiteRegistry'
import { W3cJsonLdCredentialService } from './data-integrity/W3cJsonLdCredentialService'
import { Ed25519Signature2018, Ed25519Signature2020 } from './data-integrity/signature-suites'
import { W3cJwtCredentialService } from './jwt-vc'
import { W3cCredentialRepository } from './repository/W3cCredentialRepository'

/**
 * @public
 */
export class W3cCredentialsModule implements Module {
  public readonly config: W3cCredentialsModuleConfig
  public readonly api = W3cCredentialsApi

  public constructor(config?: W3cCredentialsModuleConfigOptions) {
    this.config = new W3cCredentialsModuleConfig(config)
  }

  public register(dependencyManager: DependencyManager) {
    dependencyManager.registerSingleton(W3cCredentialService)
    dependencyManager.registerSingleton(W3cJwtCredentialService)
    dependencyManager.registerSingleton(W3cJsonLdCredentialService)
    dependencyManager.registerSingleton(W3cCredentialRepository)

    dependencyManager.registerSingleton(SignatureSuiteRegistry)

    // Register the config
    dependencyManager.registerInstance(W3cCredentialsModuleConfig, this.config)

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
