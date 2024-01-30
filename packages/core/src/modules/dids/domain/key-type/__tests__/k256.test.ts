import { KeyType } from '../../../../../crypto'
import { Key } from '../../../../../crypto/Key'
import { Buffer, JsonTransformer, TypedArrayEncoder } from '../../../../../utils'
import keySecp256k1Fixture from '../../../__tests__/__fixtures__/didKeyK256.json'
import { VerificationMethod } from '../../verificationMethod'
import { keyDidK256 } from '../k256'

const TEST_SECP256K1_BASE58_KEY = '23o6Sau8NxxzXcgSc3PLcNxrzrZpbLeBn1izfv3jbKhuv'
const TEST_SECP256K1_FINGERPRINT = 'zQ3shokFTS3brHcDQrn82RUDfCZESWL1ZdCEJwekUDPQiYBme'
const TEST_SECP256K1_DID = `did:key:${TEST_SECP256K1_FINGERPRINT}`
const TEST_SECP256K1_PREFIX_BYTES = Buffer.concat([
  new Uint8Array([231, 1]),
  TypedArrayEncoder.fromBase58(TEST_SECP256K1_BASE58_KEY),
])

describe('k256', () => {
  it('creates a Key instance from public key bytes and k256 key type', async () => {
    const publicKeyBytes = TypedArrayEncoder.fromBase58(TEST_SECP256K1_BASE58_KEY)

    const didKey = Key.fromPublicKey(publicKeyBytes, KeyType.K256)

    expect(didKey.fingerprint).toBe(TEST_SECP256K1_FINGERPRINT)
  })

  it('creates a Key instance from a base58 encoded public key and k256 key type', async () => {
    const didKey = Key.fromPublicKeyBase58(TEST_SECP256K1_BASE58_KEY, KeyType.K256)

    expect(didKey.fingerprint).toBe(TEST_SECP256K1_FINGERPRINT)
  })

  it('creates a Key instance from a fingerprint', async () => {
    const didKey = Key.fromFingerprint(TEST_SECP256K1_FINGERPRINT)

    expect(didKey.fingerprint).toBe(TEST_SECP256K1_FINGERPRINT)
  })

  it('should correctly calculate the getter properties', async () => {
    const didKey = Key.fromFingerprint(TEST_SECP256K1_FINGERPRINT)

    expect(didKey.fingerprint).toBe(TEST_SECP256K1_FINGERPRINT)
    expect(didKey.publicKeyBase58).toBe(TEST_SECP256K1_BASE58_KEY)
    expect(didKey.publicKey).toEqual(TypedArrayEncoder.fromBase58(TEST_SECP256K1_BASE58_KEY))
    expect(didKey.keyType).toBe(KeyType.K256)
    expect(didKey.prefixedPublicKey.equals(TEST_SECP256K1_PREFIX_BYTES)).toBe(true)
  })

  it('should return a valid verification method', async () => {
    const key = Key.fromFingerprint(TEST_SECP256K1_FINGERPRINT)
    const verificationMethods = keyDidK256.getVerificationMethods(TEST_SECP256K1_DID, key)

    expect(JsonTransformer.toJSON(verificationMethods)).toMatchObject([keySecp256k1Fixture.verificationMethod[0]])
  })

  it('supports EcdsaSecp256k1VerificationKey2019 verification method type', () => {
    expect(keyDidK256.supportedVerificationMethodTypes).toMatchObject(['EcdsaSecp256k1VerificationKey2019'])
  })

  it('returns key for EcdsaSecp256k1VerificationKey2019 verification method', () => {
    const verificationMethod = JsonTransformer.fromJSON(keySecp256k1Fixture.verificationMethod[0], VerificationMethod)

    const key = keyDidK256.getKeyFromVerificationMethod(verificationMethod)

    expect(key.fingerprint).toBe(TEST_SECP256K1_FINGERPRINT)
  })

  it('returns key for EcdsaSecp256k1VerificationKey2019 verification method', () => {
    const verificationMethod = JsonTransformer.fromJSON(
      {
        id: 'did:example:123',
        type: 'EcdsaSecp256k1VerificationKey2019',
        controller: 'did:example:123',
        publicKeyBase58: '23o6Sau8NxxzXcgSc3PLcNxrzrZpbLeBn1izfv3jbKhuv',
      },
      VerificationMethod
    )

    const key = keyDidK256.getKeyFromVerificationMethod(verificationMethod)

    expect(key.publicKeyBase58).toBe('23o6Sau8NxxzXcgSc3PLcNxrzrZpbLeBn1izfv3jbKhuv')
  })

  it('throws an error if an invalid verification method is passed', () => {
    const verificationMethod = JsonTransformer.fromJSON(keySecp256k1Fixture.verificationMethod[0], VerificationMethod)

    verificationMethod.type = 'SomeRandomType'

    expect(() => keyDidK256.getKeyFromVerificationMethod(verificationMethod)).toThrowError(
      "Verification method with type 'SomeRandomType' not supported for key type 'k256'"
    )
  })
})
