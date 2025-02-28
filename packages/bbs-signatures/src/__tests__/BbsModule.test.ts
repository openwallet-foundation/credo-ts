import type { DependencyManager } from '@credo-ts/core'

import {
  KeyType,
  SignatureSuiteToken,
  SigningProviderToken,
  VERIFICATION_METHOD_TYPE_BLS12381G2_KEY_2020,
} from '@credo-ts/core'

import { BbsModule } from '../BbsModule'
import { Bls12381g2SigningProvider } from '../Bls12381g2SigningProvider'
import { BbsBlsSignature2020, BbsBlsSignatureProof2020 } from '../signature-suites'

const dependencyManager = {
  registerInstance: jest.fn(),
  registerSingleton: jest.fn(),
  resolve: jest.fn().mockReturnValue({ logger: { warn: jest.fn() } }),
} as unknown as DependencyManager

describe('BbsModule', () => {
  test('registers dependencies on the dependency manager', () => {
    const bbsModule = new BbsModule()
    bbsModule.register(dependencyManager)

    expect(dependencyManager.registerSingleton).toHaveBeenCalledTimes(1)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(SigningProviderToken, Bls12381g2SigningProvider)

    expect(dependencyManager.registerInstance).toHaveBeenCalledTimes(2)
    expect(dependencyManager.registerInstance).toHaveBeenCalledWith(SignatureSuiteToken, {
      suiteClass: BbsBlsSignature2020,
      proofType: 'BbsBlsSignature2020',
      verificationMethodTypes: [VERIFICATION_METHOD_TYPE_BLS12381G2_KEY_2020],
      keyTypes: [KeyType.Bls12381g2],
    })
    expect(dependencyManager.registerInstance).toHaveBeenCalledWith(SignatureSuiteToken, {
      suiteClass: BbsBlsSignatureProof2020,
      proofType: 'BbsBlsSignatureProof2020',
      verificationMethodTypes: [VERIFICATION_METHOD_TYPE_BLS12381G2_KEY_2020],
      keyTypes: [KeyType.Bls12381g2],
    })
  })
})
