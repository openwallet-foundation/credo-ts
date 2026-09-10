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

describe('W3cCredentialsModule', () => {
  test('registers dependencies on the dependency manager', () => {
    const module = new W3cCredentialsModule()
    const dependencyManager = new DependencyManager()

    module.register(dependencyManager)

    expect(dependencyManager.isRegistered(W3cCredentialService)).toBe(true)
    expect(dependencyManager.isRegistered(W3cJsonLdCredentialService)).toBe(true)
    expect(dependencyManager.isRegistered(W3cJwtCredentialService)).toBe(true)
    expect(dependencyManager.isRegistered(W3cCredentialRepository)).toBe(true)
    expect(dependencyManager.isRegistered(SignatureSuiteRegistry)).toBe(true)
    expect(dependencyManager.resolve(W3cCredentialsModuleConfig)).toBe(module.config)

    const signatureSuiteRegistry = dependencyManager.resolve(SignatureSuiteRegistry)
    expect(signatureSuiteRegistry.getByProofType('Ed25519Signature2018').suiteClass).toBe(Ed25519Signature2018)
    expect(signatureSuiteRegistry.getByProofType('Ed25519Signature2020').suiteClass).toBe(Ed25519Signature2020)
  })

  // Remove this compatibility test when SignatureSuiteToken is removed in 0.8.
  test('registers legacy signature suites from the deprecated token', () => {
    const module = new W3cCredentialsModule()
    const dependencyManager = new DependencyManager()
    const legacySuite: SuiteInfo = {
      suiteClass: Ed25519Signature2018,
      verificationMethodTypes: ['LegacyVerificationMethod'],
      proofType: 'LegacySignatureSuite',
      supportedPublicJwkTypes: [Ed25519PublicJwk],
    }

    dependencyManager.registerInstance(SignatureSuiteToken, legacySuite)

    module.register(dependencyManager)

    const signatureSuiteRegistry = dependencyManager.resolve(SignatureSuiteRegistry)
    expect(signatureSuiteRegistry.getByProofType('LegacySignatureSuite')).toBe(legacySuite)
  })
})
