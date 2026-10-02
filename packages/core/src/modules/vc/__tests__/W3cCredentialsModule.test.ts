import { DependencyManager } from '../../../plugins/DependencyManager'
import {
  VERIFICATION_METHOD_TYPE_ED25519_VERIFICATION_KEY_2018,
  VERIFICATION_METHOD_TYPE_ED25519_VERIFICATION_KEY_2020,
} from '../../dids'
import { Ed25519PublicJwk } from '../../kms'
import { SECURITY_ED25519_2018_CONTEXT_URL, SECURITY_ED25519_2020_CONTEXT_URL } from '../constants'
import { DEFAULT_CONTEXTS } from '../jsonld/contexts'
import { W3cJwtCredentialService } from '../jwt-vc'
import { SignatureSuiteRegistry } from '../linked-data-proofs/SignatureSuiteRegistry'
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
    expect(signatureSuiteRegistry.getByProofType('Ed25519Signature2018').verificationMethodTypes).toEqual([
      VERIFICATION_METHOD_TYPE_ED25519_VERIFICATION_KEY_2018,
    ])
    expect(signatureSuiteRegistry.getByProofType('Ed25519Signature2020').suiteClass).toBe(Ed25519Signature2020)
    expect(signatureSuiteRegistry.getByProofType('Ed25519Signature2020').verificationMethodTypes).toEqual([
      VERIFICATION_METHOD_TYPE_ED25519_VERIFICATION_KEY_2020,
    ])
  })

  test('custom signature suite replaces a built-in suite without removing other built-ins', () => {
    class CustomEd25519Signature2018 extends Ed25519Signature2018 {}

    const customSuite = {
      suiteClass: CustomEd25519Signature2018,
      proofType: 'Ed25519Signature2018',
      verificationMethodTypes: [VERIFICATION_METHOD_TYPE_ED25519_VERIFICATION_KEY_2018],
      supportedPublicJwkTypes: [Ed25519PublicJwk],
    }
    const module = new W3cCredentialsModule({ signatureSuites: [customSuite] })
    const dependencyManager = new DependencyManager()

    module.register(dependencyManager)

    const registry = dependencyManager.resolve(SignatureSuiteRegistry)
    expect(registry.getByProofType('Ed25519Signature2018')).toBe(customSuite)
    expect(registry.supportedProofTypes).toEqual(['Ed25519Signature2018', 'Ed25519Signature2020'])
    expect(registry.getAllByPublicJwkType(Ed25519PublicJwk).map((suite) => suite.suiteClass)).toEqual([
      CustomEd25519Signature2018,
      Ed25519Signature2020,
    ])
    expect(registry.getByProofType('Ed25519Signature2020').suiteClass).toBe(Ed25519Signature2020)
  })

  test('ed25519 signature suites expose centrally bundled context metadata', () => {
    expect(Ed25519Signature2018.CONTEXT_URL).toBe(SECURITY_ED25519_2018_CONTEXT_URL)
    expect(Ed25519Signature2018.CONTEXT).toBe(DEFAULT_CONTEXTS[SECURITY_ED25519_2018_CONTEXT_URL])

    expect(Ed25519Signature2020.CONTEXT_URL).toBe(SECURITY_ED25519_2020_CONTEXT_URL)
    expect(Ed25519Signature2020.CONTEXT).toBe(DEFAULT_CONTEXTS[SECURITY_ED25519_2020_CONTEXT_URL])
  })
})
