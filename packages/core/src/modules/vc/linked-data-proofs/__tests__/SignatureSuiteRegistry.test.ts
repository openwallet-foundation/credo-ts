import { DependencyManager } from '../../../../plugins'
import {
  getEd25519VerificationKey2018,
  getEd25519VerificationKey2020,
  getJsonWebKey2020,
  VERIFICATION_METHOD_TYPE_ED25519_VERIFICATION_KEY_2018,
  VERIFICATION_METHOD_TYPE_ED25519_VERIFICATION_KEY_2020,
  VerificationMethod,
} from '../../../dids'
import { Ed25519PublicJwk, P256PublicJwk, PublicJwk } from '../../../kms'
import { W3cCredentialsModule } from '../../W3cCredentialsModule'
import { SignatureSuiteRegistry } from '../SignatureSuiteRegistry'
import { Ed25519Signature2018, Ed25519Signature2020 } from '../signature-suites'

const did = 'did:example:123'
const ed25519PublicJwk = PublicJwk.fromFingerprint(
  'z6MkvBpZTRb7tjuUF5AkmhG1JDV928hZbg5KAQJcogvhz9ax'
) as PublicJwk<Ed25519PublicJwk>

const ed25519Signature2018 = {
  suiteClass: Ed25519Signature2018,
  proofType: 'Ed25519Signature2018',
  verificationMethodTypes: [VERIFICATION_METHOD_TYPE_ED25519_VERIFICATION_KEY_2018],
  supportedPublicJwkTypes: [Ed25519PublicJwk],
}

const ed25519Signature2020 = {
  suiteClass: Ed25519Signature2020,
  proofType: 'Ed25519Signature2020',
  verificationMethodTypes: [VERIFICATION_METHOD_TYPE_ED25519_VERIFICATION_KEY_2020],
  supportedPublicJwkTypes: [Ed25519PublicJwk],
}

const registry = new SignatureSuiteRegistry([ed25519Signature2018, ed25519Signature2020])

describe('SignatureSuiteRegistry', () => {
  describe('getAllByVerificationMethod', () => {
    test('returns only Ed25519Signature2020 for an Ed25519VerificationKey2020 method', () => {
      const verificationMethod = getEd25519VerificationKey2020({
        id: `${did}#key-1`,
        controller: did,
        publicJwk: ed25519PublicJwk,
      })

      expect(registry.getAllByVerificationMethod(verificationMethod)).toEqual([ed25519Signature2020])
    })

    test('returns only Ed25519Signature2018 for an Ed25519VerificationKey2018 method', () => {
      const verificationMethod = getEd25519VerificationKey2018({
        id: `${did}#key-1`,
        controller: did,
        publicJwk: ed25519PublicJwk,
      })

      expect(registry.getAllByVerificationMethod(verificationMethod)).toEqual([ed25519Signature2018])
    })

    test('returns an empty list for a verification method type no suite supports', () => {
      const verificationMethod = new VerificationMethod(
        getJsonWebKey2020({ did, verificationMethodId: `${did}#key-1`, publicJwk: ed25519PublicJwk })
      )

      expect(registry.getAllByVerificationMethod(verificationMethod)).toEqual([])
    })

    test('returns an empty list for an unknown verification method type', () => {
      const verificationMethod = new VerificationMethod({
        id: `${did}#key-1`,
        type: 'UnknownVerificationKey2030',
        controller: did,
        publicKeyMultibase: ed25519PublicJwk.fingerprint,
      })

      expect(registry.getAllByVerificationMethod(verificationMethod)).toEqual([])
    })

    test('returns an empty list when the key type of the method is not supported by the suite', () => {
      const p256Registry = new SignatureSuiteRegistry([
        { ...ed25519Signature2020, supportedPublicJwkTypes: [P256PublicJwk] },
      ])
      const verificationMethod = getEd25519VerificationKey2020({
        id: `${did}#key-1`,
        controller: did,
        publicJwk: ed25519PublicJwk,
      })

      expect(p256Registry.getAllByVerificationMethod(verificationMethod)).toEqual([])
    })

    test('keeps the registration order', () => {
      const otherSuite = { ...ed25519Signature2020, proofType: 'Other2020' }
      const orderedRegistry = new SignatureSuiteRegistry([ed25519Signature2018, otherSuite, ed25519Signature2020])
      const verificationMethod = getEd25519VerificationKey2020({
        id: `${did}#key-1`,
        controller: did,
        publicJwk: ed25519PublicJwk,
      })

      expect(orderedRegistry.getAllByVerificationMethod(verificationMethod).map((s) => s.proofType)).toEqual([
        'Other2020',
        'Ed25519Signature2020',
      ])
    })

    test('matches the suites registered by the W3cCredentialsModule by verification method type', () => {
      const dependencyManager = new DependencyManager()
      new W3cCredentialsModule().register(dependencyManager)
      const moduleRegistry = dependencyManager.resolve(SignatureSuiteRegistry)
      const proofTypes = (verificationMethod: VerificationMethod) =>
        moduleRegistry.getAllByVerificationMethod(verificationMethod).map((suite) => suite.proofType)

      expect(
        proofTypes(getEd25519VerificationKey2018({ id: `${did}#key-1`, controller: did, publicJwk: ed25519PublicJwk }))
      ).toEqual(['Ed25519Signature2018'])
      expect(
        proofTypes(getEd25519VerificationKey2020({ id: `${did}#key-1`, controller: did, publicJwk: ed25519PublicJwk }))
      ).toEqual(['Ed25519Signature2020'])
    })
  })
})
