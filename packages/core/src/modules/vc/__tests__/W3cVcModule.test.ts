import { KeyType } from '../../../crypto'
import { DependencyManager } from '../../../plugins/DependencyManager'
import { SignatureSuiteRegistry, SignatureSuiteToken } from '../SignatureSuiteRegistry'
import { W3cCredentialService } from '../W3cCredentialService'
import { W3cVcModule } from '../W3cVcModule'
import { W3cVcModuleConfig } from '../W3cVcModuleConfig'
import { W3cCredentialRepository } from '../repository'
import { Ed25519Signature2018 } from '../signature-suites'

jest.mock('../../../plugins/DependencyManager')
const DependencyManagerMock = DependencyManager as jest.Mock<DependencyManager>

const dependencyManager = new DependencyManagerMock()

describe('W3cVcModule', () => {
  test('registers dependencies on the dependency manager', () => {
    const module = new W3cVcModule()

    module.register(dependencyManager)

    expect(dependencyManager.registerSingleton).toHaveBeenCalledTimes(3)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(W3cCredentialService)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(W3cCredentialRepository)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(SignatureSuiteRegistry)

    expect(dependencyManager.registerInstance).toHaveBeenCalledTimes(2)
    expect(dependencyManager.registerInstance).toHaveBeenCalledWith(W3cVcModuleConfig, module.config)

    expect(dependencyManager.registerInstance).toHaveBeenCalledWith(SignatureSuiteToken, {
      suiteClass: Ed25519Signature2018,
      verificationMethodTypes: ['Ed25519VerificationKey2018', 'Ed25519VerificationKey2020'],
      proofType: 'Ed25519Signature2018',
      keyTypes: [KeyType.Ed25519],
    })
  })
})
