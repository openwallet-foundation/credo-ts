import type { W3cVcModuleConfigOptions } from './W3cVcModuleConfig'
import type { DependencyManager, Module } from '../../plugins'

import { KeyType } from '../../crypto'
import {
  VERIFICATION_METHOD_TYPE_ED25519_VERIFICATION_KEY_2018,
  VERIFICATION_METHOD_TYPE_ED25519_VERIFICATION_KEY_2020,
} from '../dids/domain/key-type/ed25519'

import { SignatureSuiteRegistry, SignatureSuiteToken } from './SignatureSuiteRegistry'
import { W3cCredentialService } from './W3cCredentialService'
import { W3cVcModuleConfig } from './W3cVcModuleConfig'
import { W3cCredentialRepository } from './repository/W3cCredentialRepository'
import { Ed25519Signature2018 } from './signature-suites'

export class W3cVcModule implements Module {
  public readonly config: W3cVcModuleConfig

  public constructor(config?: W3cVcModuleConfigOptions) {
    this.config = new W3cVcModuleConfig(config)
  }

  public register(dependencyManager: DependencyManager) {
    dependencyManager.registerSingleton(W3cCredentialService)
    dependencyManager.registerSingleton(W3cCredentialRepository)

    dependencyManager.registerSingleton(SignatureSuiteRegistry)

    // Register the config
    dependencyManager.registerInstance(W3cVcModuleConfig, this.config)

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
