import { KeyType } from '../../../../../crypto'
import { Key } from '../../../../../crypto/Key'
import { Buffer, JsonTransformer, TypedArrayEncoder } from '../../../../../utils'
import keyBls12381g2Fixture from '../../../__tests__/__fixtures__/didKeyBls12381g2.json'
import { VerificationMethod } from '../../verificationMethod'
import { keyDidBls12381g2 } from '../bls12381g2'

const TEST_BLS12381G2_BASE58_KEY =
  'mxE4sHTpbPcmxNviRVR9r7D2taXcNyVJmf9TBUFS1gRt3j3Ej9Seo59GQeCzYwbQgDrfWCwEJvmBwjLvheAky5N2NqFVzk4kuq3S8g4Fmekai4P622vHqWjFrsioYYDqhf9'
const TEST_BLS12381G2_FINGERPRINT =
  'zUC71nmwvy83x1UzNKbZbS7N9QZx8rqpQx3Ee3jGfKiEkZngTKzsRoqobX6wZdZF5F93pSGYYco3gpK9tc53ruWUo2tkBB9bxPCFBUjq2th8FbtT4xih6y6Q1K9EL4Th86NiCGT'
const TEST_BLS12381G2_DID = `did:key:${TEST_BLS12381G2_FINGERPRINT}`
const TEST_BLS12381G2_PREFIX_BYTES = Buffer.concat([
  new Uint8Array([235, 1]),
  TypedArrayEncoder.fromBase58(TEST_BLS12381G2_BASE58_KEY),
])

describe('bls12381g2', () => {
  it('creates a Key instance from public key bytes and bls12381g2 key type', async () => {
    const publicKeyBytes = TypedArrayEncoder.fromBase58(TEST_BLS12381G2_BASE58_KEY)

    const key = Key.fromPublicKey(publicKeyBytes, KeyType.Bls12381g2)

    expect(key.fingerprint).toBe(TEST_BLS12381G2_FINGERPRINT)
  })

  it('creates a Key instance from a base58 encoded public key and bls12381g2 key type', async () => {
    const key = Key.fromPublicKeyBase58(TEST_BLS12381G2_BASE58_KEY, KeyType.Bls12381g2)

    expect(key.fingerprint).toBe(TEST_BLS12381G2_FINGERPRINT)
  })

  it('creates a Key instance from a fingerprint', async () => {
    const key = Key.fromFingerprint(TEST_BLS12381G2_FINGERPRINT)

    expect(key.publicKeyBase58).toBe(TEST_BLS12381G2_BASE58_KEY)
  })

  it('should correctly calculate the getter properties', async () => {
    const key = Key.fromFingerprint(TEST_BLS12381G2_FINGERPRINT)

    expect(key.fingerprint).toBe(TEST_BLS12381G2_FINGERPRINT)
    expect(key.publicKeyBase58).toBe(TEST_BLS12381G2_BASE58_KEY)
    expect(key.publicKey).toEqual(Uint8Array.from(TypedArrayEncoder.fromBase58(TEST_BLS12381G2_BASE58_KEY)))
    expect(key.keyType).toBe(KeyType.Bls12381g2)
    expect(Buffer.from(key.prefixedPublicKey).equals(TEST_BLS12381G2_PREFIX_BYTES)).toBe(true)
  })

  it('should return a valid verification method', async () => {
    const key = Key.fromFingerprint(TEST_BLS12381G2_FINGERPRINT)
    const verificationMethods = keyDidBls12381g2.getVerificationMethods(TEST_BLS12381G2_DID, key)

    expect(JsonTransformer.toJSON(verificationMethods)).toMatchObject([keyBls12381g2Fixture.verificationMethod[0]])
  })

  it('supports Bls12381G2Key2020 verification method type', () => {
    expect(keyDidBls12381g2.supportedVerificationMethodTypes).toMatchObject(['Bls12381G2Key2020'])
  })

  it('returns key for Bls12381G2Key2020 verification method', () => {
    const verificationMethod = JsonTransformer.fromJSON(keyBls12381g2Fixture.verificationMethod[0], VerificationMethod)

    const key = keyDidBls12381g2.getKeyFromVerificationMethod(verificationMethod)

    expect(key.fingerprint).toBe(TEST_BLS12381G2_FINGERPRINT)
  })

  it('throws an error if an invalid verification method is passed', () => {
    const verificationMethod = JsonTransformer.fromJSON(keyBls12381g2Fixture.verificationMethod[0], VerificationMethod)

    verificationMethod.type = 'SomeRandomType'

    expect(() => keyDidBls12381g2.getKeyFromVerificationMethod(verificationMethod)).toThrowError(
      "Verification method with type 'SomeRandomType' not supported for key type 'bls12381g2'"
    )
  })
})
