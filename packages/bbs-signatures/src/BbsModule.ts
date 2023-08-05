import type { DependencyManager, Module } from '@aries-framework/core'

import {
  KeyType,
  SigningProviderToken,
  VERIFICATION_METHOD_TYPE_BLS12381G2_KEY_2020,
  SignatureSuiteToken,
} from '@aries-framework/core'

import { Bls12381g2SigningProvider } from './Bls12381g2SigningProvider'
import { BbsBlsSignature2020, BbsBlsSignatureProof2020 } from './signature-suites'

export class BbsModule implements Module {
  /**
   * Registers the dependencies of the bbs module on the dependency manager.
   */
  public register(dependencyManager: DependencyManager) {
    // Signing providers.
    dependencyManager.registerSingleton(SigningProviderToken, Bls12381g2SigningProvider)

    // Signature suites.
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
