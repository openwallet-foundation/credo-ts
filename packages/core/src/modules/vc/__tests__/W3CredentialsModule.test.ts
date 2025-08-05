import { DependencyManager } from '../../../plugins/DependencyManager'
import { Ed25519PublicJwk } from '../../kms'
import { W3cCredentialService } from '../W3cCredentialService'
import { W3cCredentialsModule } from '../W3cCredentialsModule'
import { W3cCredentialsModuleConfig } from '../W3cCredentialsModuleConfig'
import { SignatureSuiteRegistry, SignatureSuiteToken, SuiteInfo } from '../data-integrity/SignatureSuiteRegistry'
import { W3cJsonLdCredentialService } from '../data-integrity/W3cJsonLdCredentialService'
import { Ed25519Signature2018, Ed25519Signature2020 } from '../data-integrity/signature-suites'
import { W3cJwtCredentialService } from '../jwt-vc'
import { W3cCredentialRepository } from '../repository'

jest.mock('../../../plugins/DependencyManager')
const DependencyManagerMock = DependencyManager as jest.Mock<DependencyManager>

const dependencyManager = new DependencyManagerMock()

describe('W3cCredentialsModule', () => {
  test('registers dependencies on the dependency manager', () => {
    const module = new W3cCredentialsModule()

    module.register(dependencyManager)

    expect(dependencyManager.registerSingleton).toHaveBeenCalledTimes(5)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(W3cCredentialService)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(W3cJsonLdCredentialService)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(W3cJwtCredentialService)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(W3cCredentialRepository)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(SignatureSuiteRegistry)

    expect(dependencyManager.registerInstance).toHaveBeenCalledTimes(3)
    expect(dependencyManager.registerInstance).toHaveBeenCalledWith(W3cCredentialsModuleConfig, module.config)

    expect(dependencyManager.registerInstance).toHaveBeenCalledWith(SignatureSuiteToken, {
      suiteClass: Ed25519Signature2018,
      verificationMethodTypes: ['Ed25519VerificationKey2018', 'Ed25519VerificationKey2020'],
      proofType: 'Ed25519Signature2018',
      supportedPublicJwkTypes: [Ed25519PublicJwk],
    } satisfies SuiteInfo)
    expect(dependencyManager.registerInstance).toHaveBeenCalledWith(SignatureSuiteToken, {
      suiteClass: Ed25519Signature2020,
      verificationMethodTypes: ['Ed25519VerificationKey2020'],
      proofType: 'Ed25519Signature2020',
      supportedPublicJwkTypes: [Ed25519PublicJwk],
    } satisfies SuiteInfo)
  })
})
