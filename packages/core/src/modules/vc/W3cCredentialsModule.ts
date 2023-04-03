import type { W3cVcModuleConfigOptions } from './W3cCredentialsModuleConfig'
import type { DependencyManager, Module } from '../../plugins'

import { KeyType } from '../../crypto'
import {
  VERIFICATION_METHOD_TYPE_ED25519_VERIFICATION_KEY_2018,
  VERIFICATION_METHOD_TYPE_ED25519_VERIFICATION_KEY_2020,
} from '../dids/domain/key-type/ed25519'

import { SignatureSuiteRegistry, SignatureSuiteToken } from './SignatureSuiteRegistry'
import { W3cCredentialService } from './W3cCredentialService'
import { W3cVcApi } from './W3cCredentialsApi'
import { W3cCredentialsModuleConfig } from './W3cCredentialsModuleConfig'
import { W3cCredentialRepository } from './repository/W3cCredentialRepository'
import { Ed25519Signature2018 } from './signature-suites'

/**
 * @public
 */
export class W3cCredentialsModule implements Module {
  public readonly config: W3cCredentialsModuleConfig
  public readonly api = W3cVcApi

  public constructor(config?: W3cVcModuleConfigOptions) {
    this.config = new W3cCredentialsModuleConfig(config)
  }

  public register(dependencyManager: DependencyManager) {
    dependencyManager.registerContextScoped(W3cVcApi)
    dependencyManager.registerSingleton(W3cCredentialService)
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
      keyTypes: [KeyType.Ed25519],
    })
  }
}
