import type { MockedClassConstructor } from '../../../../../../tests/types'
import { DependencyManager } from '../../../plugins/DependencyManager'
import { Ed25519PublicJwk } from '../../kms'
import { W3cJwtCredentialService } from '../jwt-vc'
import {
  SignatureSuiteRegistry,
  SignatureSuiteToken,
  type SuiteInfo,
} from '../linked-data-proofs/SignatureSuiteRegistry'
import { Ed25519Signature2018, Ed25519Signature2020 } from '../linked-data-proofs/signature-suites'
import { W3cJsonLdCredentialService } from '../linked-data-proofs/W3cJsonLdCredentialService'
import { W3cCredentialRepository } from '../repository'
import { W3cCredentialService } from '../W3cCredentialService'
import { W3cCredentialsModule } from '../W3cCredentialsModule'
import { W3cCredentialsModuleConfig } from '../W3cCredentialsModuleConfig'

vi.mock('../../../plugins/DependencyManager')
const DependencyManagerMock = DependencyManager as MockedClassConstructor<typeof DependencyManager>

const dependencyManager = new DependencyManagerMock()

describe('W3cCredentialsModule', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('registers dependencies on the dependency manager', () => {
    const module = new W3cCredentialsModule()
    const signatureSuiteRegistry = { registerSuites: vi.fn() }
    vi.mocked(dependencyManager.resolve).mockReturnValue(signatureSuiteRegistry as never)
    vi.mocked(dependencyManager.isRegistered).mockReturnValue(false)

    module.register(dependencyManager)

    expect(dependencyManager.registerSingleton).toHaveBeenCalledTimes(5)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(W3cCredentialService)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(W3cJsonLdCredentialService)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(W3cJwtCredentialService)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(W3cCredentialRepository)
    expect(dependencyManager.registerSingleton).toHaveBeenCalledWith(SignatureSuiteRegistry)

    expect(dependencyManager.registerInstance).toHaveBeenCalledTimes(1)
    expect(dependencyManager.registerInstance).toHaveBeenCalledWith(W3cCredentialsModuleConfig, module.config)
    expect(dependencyManager.isRegistered).toHaveBeenCalledWith(SignatureSuiteToken)
    expect(dependencyManager.resolve).toHaveBeenCalledWith(SignatureSuiteRegistry)
    expect(signatureSuiteRegistry.registerSuites).toHaveBeenCalledTimes(1)
    expect(signatureSuiteRegistry.registerSuites).toHaveBeenCalledWith([
      {
        suiteClass: Ed25519Signature2018,
        verificationMethodTypes: ['Ed25519VerificationKey2018', 'Ed25519VerificationKey2020'],
        proofType: 'Ed25519Signature2018',
        supportedPublicJwkTypes: [Ed25519PublicJwk],
      } satisfies SuiteInfo,
      {
        suiteClass: Ed25519Signature2020,
        verificationMethodTypes: ['Ed25519VerificationKey2020'],
        proofType: 'Ed25519Signature2020',
        supportedPublicJwkTypes: [Ed25519PublicJwk],
      } satisfies SuiteInfo,
    ])
  })

  // Remove this compatibility test when SignatureSuiteToken is removed in 0.8.
  test('registers legacy signature suites from the deprecated token', () => {
    const module = new W3cCredentialsModule()
    const signatureSuiteRegistry = { registerSuites: vi.fn() }
    const legacySuite: SuiteInfo = {
      suiteClass: Ed25519Signature2018,
      verificationMethodTypes: ['LegacyVerificationMethod'],
      proofType: 'LegacySignatureSuite',
      supportedPublicJwkTypes: [Ed25519PublicJwk],
    }

    vi.mocked(dependencyManager.resolve).mockReturnValue(signatureSuiteRegistry as never)
    vi.mocked(dependencyManager.isRegistered).mockReturnValue(true)
    dependencyManager.container = { resolveAll: vi.fn().mockReturnValue([legacySuite]) } as never

    module.register(dependencyManager)

    expect(dependencyManager.container.resolveAll).toHaveBeenCalledWith(SignatureSuiteToken)
    expect(signatureSuiteRegistry.registerSuites).toHaveBeenCalledWith([
      legacySuite,
      {
        suiteClass: Ed25519Signature2018,
        verificationMethodTypes: ['Ed25519VerificationKey2018', 'Ed25519VerificationKey2020'],
        proofType: 'Ed25519Signature2018',
        supportedPublicJwkTypes: [Ed25519PublicJwk],
      } satisfies SuiteInfo,
      {
        suiteClass: Ed25519Signature2020,
        verificationMethodTypes: ['Ed25519VerificationKey2020'],
        proofType: 'Ed25519Signature2020',
        supportedPublicJwkTypes: [Ed25519PublicJwk],
      } satisfies SuiteInfo,
    ])
  })
})
