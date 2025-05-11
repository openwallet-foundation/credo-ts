import { JsonTransformer } from '../../../../../utils'
import { PublicJwk, X25519PublicJwk } from '../../../../kms'
import didKeyX25519Fixture from '../../../__tests__/__fixtures__/didKeyX25519.json'
import { VerificationMethod } from '../../verificationMethod'
import { keyDidX25519 } from '../x25519'

const TEST_X25519_FINGERPRINT = 'z6LShLeXRTzevtwcfehaGEzCMyL3bNsAeKCwcqwJxyCo63yE'
const TEST_X25519_DID = `did:key:${TEST_X25519_FINGERPRINT}`

describe('x25519', () => {
  it('should return a valid verification method', async () => {
    const key = PublicJwk.fromFingerprint(TEST_X25519_FINGERPRINT) as PublicJwk<X25519PublicJwk>
    const verificationMethods = keyDidX25519.getVerificationMethods(TEST_X25519_DID, key)

    expect(JsonTransformer.toJSON(verificationMethods)).toMatchObject([didKeyX25519Fixture.keyAgreement[0]])
  })

  it('supports X25519KeyAgreementKey2019 verification method type', () => {
    expect(keyDidX25519.supportedVerificationMethodTypes).toMatchObject([
      'X25519KeyAgreementKey2019',
      'JsonWebKey2020',
      'Multikey',
    ])
  })

  it('returns key for X25519KeyAgreementKey2019 verification method', () => {
    const verificationMethod = JsonTransformer.fromJSON(didKeyX25519Fixture.keyAgreement[0], VerificationMethod)

    const key = keyDidX25519.getPublicJwkFromVerificationMethod(verificationMethod)

    expect(key.fingerprint).toBe(TEST_X25519_FINGERPRINT)
  })

  it('throws an error if an invalid verification method is passed', () => {
    const verificationMethod = JsonTransformer.fromJSON(didKeyX25519Fixture.keyAgreement[0], VerificationMethod)

    verificationMethod.type = 'SomeRandomType'

    expect(() => keyDidX25519.getPublicJwkFromVerificationMethod(verificationMethod)).toThrow(
      `Verification method with type 'SomeRandomType' not supported for key type X25519`
    )
  })
})
