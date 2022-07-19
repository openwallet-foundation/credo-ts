import type { DependencyManager } from '../../plugins'

import { KeyType } from '../../crypto'
import { module } from '../../plugins'

import { SignatureSuiteRegistry, SignatureSuiteToken } from './SignatureSuiteRegistry'
import { W3cCredentialService } from './W3cCredentialService'
import { W3cCredentialRepository } from './repository/W3cCredentialRepository'
import { Ed25519Signature2018 } from './signature-suites'
import { BbsBlsSignature2020, BbsBlsSignatureProof2020 } from './signature-suites/bbs'

@module()
export class W3cVcModule {
  public static register(dependencyManager: DependencyManager) {
    dependencyManager.registerSingleton(W3cCredentialService)
    dependencyManager.registerSingleton(W3cCredentialRepository)

    dependencyManager.registerSingleton(SignatureSuiteRegistry)

    // Always register ed25519 signature suite
    dependencyManager.registerInstance(SignatureSuiteToken, {
      suiteClass: Ed25519Signature2018,
      proofType: 'Ed25519Signature2018',
      requiredKeyType: 'Ed25519VerificationKey2018',
      keyType: KeyType.Ed25519,
    })

    // This will be moved out of core into the bbs module
    dependencyManager.registerInstance(SignatureSuiteToken, {
      suiteClass: BbsBlsSignature2020,
      proofType: 'BbsBlsSignature2020',
      requiredKeyType: 'BbsBlsSignatureProof2020',
      keyType: KeyType.Bls12381g2,
    })
    dependencyManager.registerInstance(SignatureSuiteToken, {
      suiteClass: BbsBlsSignatureProof2020,
      proofType: 'BbsBlsSignatureProof2020',
      requiredKeyType: 'BbsBlsSignatureProof2020',
      keyType: KeyType.Bls12381g2,
    })
  }
}
