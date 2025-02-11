import { KeyType } from '../../../../../crypto'
import { Key } from '../../../../../crypto/Key'
import { Buffer, JsonTransformer, TypedArrayEncoder } from '../../../../../utils'
import keyBls12381g1Fixture from '../../../__tests__/__fixtures__/didKeyBls12381g1.json'
import { VerificationMethod } from '../../verificationMethod'
import { keyDidBls12381g1 } from '../bls12381g1'

const TEST_BLS12381G1_BASE58_KEY = '6FywSzB5BPd7xehCo1G4nYHAoZPMMP3gd4PLnvgA6SsTsogtz8K7RDznqLpFPLZXAE'
const TEST_BLS12381G1_FINGERPRINT = 'z3tEFALUKUzzCAvytMHX8X4SnsNsq6T5tC5Zb18oQEt1FqNcJXqJ3AA9umgzA9yoqPBeWA'
const TEST_BLS12381G1_DID = `did:key:${TEST_BLS12381G1_FINGERPRINT}`
const TEST_BLS12381G1_PREFIX_BYTES = Buffer.concat([
  new Uint8Array([234, 1]),
  TypedArrayEncoder.fromBase58(TEST_BLS12381G1_BASE58_KEY),
])

describe('bls12381g1', () => {
  it('creates a Key instance from public key bytes and bls12381g1 key type', async () => {
    const publicKeyBytes = TypedArrayEncoder.fromBase58(TEST_BLS12381G1_BASE58_KEY)

    const key = Key.fromPublicKey(publicKeyBytes, KeyType.Bls12381g1)

    expect(key.fingerprint).toBe(TEST_BLS12381G1_FINGERPRINT)
  })

  it('creates a Key instance from a base58 encoded public key and bls12381g1 key type', async () => {
    const key = Key.fromPublicKeyBase58(TEST_BLS12381G1_BASE58_KEY, KeyType.Bls12381g1)

    expect(key.fingerprint).toBe(TEST_BLS12381G1_FINGERPRINT)
  })

  it('creates a Key instance from a fingerprint', async () => {
    const key = Key.fromFingerprint(TEST_BLS12381G1_FINGERPRINT)

    expect(key.publicKeyBase58).toBe(TEST_BLS12381G1_BASE58_KEY)
  })

  it('should correctly calculate the getter properties', async () => {
    const key = Key.fromFingerprint(TEST_BLS12381G1_FINGERPRINT)

    expect(key.fingerprint).toBe(TEST_BLS12381G1_FINGERPRINT)
    expect(key.publicKeyBase58).toBe(TEST_BLS12381G1_BASE58_KEY)
    expect(key.publicKey).toEqual(Uint8Array.from(TypedArrayEncoder.fromBase58(TEST_BLS12381G1_BASE58_KEY)))
    expect(key.keyType).toBe(KeyType.Bls12381g1)
    expect(Buffer.from(key.prefixedPublicKey).equals(TEST_BLS12381G1_PREFIX_BYTES)).toBe(true)
  })

  it('should return a valid verification method', async () => {
    const key = Key.fromFingerprint(TEST_BLS12381G1_FINGERPRINT)
    const verificationMethods = keyDidBls12381g1.getVerificationMethods(TEST_BLS12381G1_DID, key)

    expect(JsonTransformer.toJSON(verificationMethods)).toMatchObject([keyBls12381g1Fixture.verificationMethod[0]])
  })

  it('supports Bls12381G1Key2020 verification method type', () => {
    expect(keyDidBls12381g1.supportedVerificationMethodTypes).toMatchObject(['Bls12381G1Key2020'])
  })

  it('returns key for Bls12381G1Key2020 verification method', () => {
    const verificationMethod = JsonTransformer.fromJSON(keyBls12381g1Fixture.verificationMethod[0], VerificationMethod)

    const key = keyDidBls12381g1.getKeyFromVerificationMethod(verificationMethod)

    expect(key.fingerprint).toBe(TEST_BLS12381G1_FINGERPRINT)
  })

  it('throws an error if an invalid verification method is passed', () => {
    const verificationMethod = JsonTransformer.fromJSON(keyBls12381g1Fixture.verificationMethod[0], VerificationMethod)

    verificationMethod.type = 'SomeRandomType'

    expect(() => keyDidBls12381g1.getKeyFromVerificationMethod(verificationMethod)).toThrow(
      "Verification method with type 'SomeRandomType' not supported for key type 'bls12381g1'"
    )
  })
})
