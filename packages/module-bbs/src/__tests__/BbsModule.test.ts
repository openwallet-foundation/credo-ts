import {
  InjectionSymbols,
  KeyType,
  SigningProviderToken,
  VERIFICATION_METHOD_TYPE_BLS12381G2_KEY_2020,
} from '@aries-framework/core'

import { DependencyManager } from '@aries-framework/core'
import { SignatureSuiteToken } from '@aries-framework/core/src/modules/vc/SignatureSuiteRegistry'
import { BbsBlsSignature2020, BbsBlsSignatureProof2020 } from '..'
import { BbsModule } from '../BbsModule'
import { Bls12381g2SigningProvider } from '../Bls12381g2SigningProvider'

jest.mock('../../../core/src/plugins/DependencyManager')
const DependencyManagerMock = DependencyManager as jest.Mock<DependencyManager>

const dependencyManager = new DependencyManagerMock()

describe('BbsModule', () => {
  test('registers dependencies on the dependency manager', () => {
    const tenantsModule = new BbsModule()
    tenantsModule.register(dependencyManager)

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
