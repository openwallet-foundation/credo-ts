import type { DependencyManager, Module } from '../../plugins'

import { KeyType } from '../../crypto'
import { VERIFICATION_METHOD_TYPE_BLS12381G2_KEY_2020 } from '../dids/domain/key-type/bls12381g2'
import {
  VERIFICATION_METHOD_TYPE_ED25519_VERIFICATION_KEY_2018,
  VERIFICATION_METHOD_TYPE_ED25519_VERIFICATION_KEY_2020,
} from '../dids/domain/key-type/ed25519'

import { SignatureSuiteRegistry, SignatureSuiteToken } from './SignatureSuiteRegistry'
import { W3cCredentialService } from './W3cCredentialService'
import { W3cCredentialRepository } from './repository/W3cCredentialRepository'
import { Ed25519Signature2018 } from './signature-suites'
import { BbsBlsSignature2020, BbsBlsSignatureProof2020 } from './signature-suites/bbs'

export class W3cVcModule implements Module {
  public register(dependencyManager: DependencyManager) {
    dependencyManager.registerSingleton(W3cCredentialService)
    dependencyManager.registerSingleton(W3cCredentialRepository)

    dependencyManager.registerSingleton(SignatureSuiteRegistry)

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

    // This will be moved out of core into the bbs module
    dependencyManager.registerInstance(SignatureSuiteToken, {
      suiteClass: BbsBlsSignature2020,
      proofType: 'BbsBlsSignature2020',
      verificationMethodTypes: [VERIFICATION_METHOD_TYPE_BLS12381G2_KEY_2020],
      keyTypes: [KeyType.Bls12381g2],
    })
    dependencyManager.registerInstance(SignatureSuiteToken, {
      suiteClass: BbsBlsSignatureProof2020,
      proofType: 'BbsBlsSignatureProof2020',
      verificationMethodTypes: [VERIFICATION_METHOD_TYPE_BLS12381G2_KEY_2020],
      keyTypes: [KeyType.Bls12381g2],
    })
  }
}
