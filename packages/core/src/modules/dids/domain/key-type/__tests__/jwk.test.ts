import { Key } from '../../../../../crypto/Key'
import { JsonTransformer } from '../../../../../utils'
import didKeyP256Fixture from '../../../__tests__/__fixtures__/didKeyP256.json'
import { VerificationMethod } from '../../verificationMethod'
import { VERIFICATION_METHOD_TYPE_JSON_WEB_KEY_2020 } from '../../verificationMethod/JsonWebKey2020'
import { keyDidJsonWebKey } from '../keyDidJsonWebKey'

const TEST_P256_FINGERPRINT = 'zDnaerx9CtbPJ1q36T5Ln5wYt3MQYeGRG5ehnPAmxcf5mDZpv'
const TEST_P256_DID = `did:key:${TEST_P256_FINGERPRINT}`

describe('keyDidJsonWebKey', () => {
  it('should return a valid verification method', async () => {
    const key = Key.fromFingerprint(TEST_P256_FINGERPRINT)
    const verificationMethods = keyDidJsonWebKey.getVerificationMethods(TEST_P256_DID, key)

    expect(JsonTransformer.toJSON(verificationMethods)).toMatchObject([didKeyP256Fixture.verificationMethod[0]])
  })

  it('supports no verification method type', () => {
    expect(keyDidJsonWebKey.supportedVerificationMethodTypes).toMatchObject([
      VERIFICATION_METHOD_TYPE_JSON_WEB_KEY_2020,
    ])
  })

  it('returns key for JsonWebKey2020 verification method', () => {
    const verificationMethod = JsonTransformer.fromJSON(didKeyP256Fixture.verificationMethod[0], VerificationMethod)

    const key = keyDidJsonWebKey.getKeyFromVerificationMethod(verificationMethod)

    expect(key.fingerprint).toBe(TEST_P256_FINGERPRINT)
  })

  it('throws an error if an invalid verification method is passed', () => {
    const verificationMethod = JsonTransformer.fromJSON(didKeyP256Fixture.verificationMethod[0], VerificationMethod)

    verificationMethod.type = 'SomeRandomType'

    expect(() => keyDidJsonWebKey.getKeyFromVerificationMethod(verificationMethod)).toThrow(
      'Invalid verification method passed'
    )
  })
})
