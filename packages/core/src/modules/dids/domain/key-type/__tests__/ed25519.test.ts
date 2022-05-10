import { KeyType } from '../../../../../crypto'
import { JsonTransformer, TypedArrayEncoder, Buffer } from '../../../../../utils'
import didKeyEd25519Fixture from '../../../__tests__/__fixtures__//didKeyEd25519.json'
import { Key } from '../../../domain/Key'
import { VerificationMethod } from '../../../domain/verificationMethod'
import { keyDidEd25519 } from '../ed25519'

const TEST_ED25519_BASE58_KEY = '8HH5gYEeNc3z7PYXmd54d4x6qAfCNrqQqEB3nS7Zfu7K'
const TEST_ED25519_FINGERPRINT = 'z6MkmjY8GnV5i9YTDtPETC2uUAW6ejw3nk5mXF5yci5ab7th'
const TEST_ED25519_DID = `did:key:${TEST_ED25519_FINGERPRINT}`
const TEST_ED25519_PREFIX_BYTES = Buffer.concat([
  new Uint8Array([237, 1]),
  TypedArrayEncoder.fromBase58(TEST_ED25519_BASE58_KEY),
])

describe('ed25519', () => {
  it('creates a Key instance from public key bytes and ed25519 key type', async () => {
    const publicKeyBytes = TypedArrayEncoder.fromBase58(TEST_ED25519_BASE58_KEY)

    const didKey = Key.fromPublicKey(publicKeyBytes, KeyType.Ed25519)

    expect(didKey.fingerprint).toBe(TEST_ED25519_FINGERPRINT)
  })

  it('creates a Key instance from a base58 encoded public key and ed25519 key type', async () => {
    const didKey = Key.fromPublicKeyBase58(TEST_ED25519_BASE58_KEY, KeyType.Ed25519)

    expect(didKey.fingerprint).toBe(TEST_ED25519_FINGERPRINT)
  })

  it('creates a Key instance from a fingerprint', async () => {
    const didKey = Key.fromFingerprint(TEST_ED25519_FINGERPRINT)

    expect(didKey.fingerprint).toBe(TEST_ED25519_FINGERPRINT)
  })

  it('should correctly calculate the getter properties', async () => {
    const didKey = Key.fromFingerprint(TEST_ED25519_FINGERPRINT)

    expect(didKey.fingerprint).toBe(TEST_ED25519_FINGERPRINT)
    expect(didKey.publicKeyBase58).toBe(TEST_ED25519_BASE58_KEY)
    expect(didKey.publicKey).toEqual(TypedArrayEncoder.fromBase58(TEST_ED25519_BASE58_KEY))
    expect(didKey.keyType).toBe(KeyType.Ed25519)
    expect(didKey.prefixedPublicKey.equals(TEST_ED25519_PREFIX_BYTES)).toBe(true)
  })

  it('should return a valid did:key did document for the did', async () => {
    const key = Key.fromFingerprint(TEST_ED25519_FINGERPRINT)
    const didDocument = keyDidEd25519.getDidDocument(TEST_ED25519_DID, key)

    expect(JsonTransformer.toJSON(didDocument)).toMatchObject(didKeyEd25519Fixture)
  })

  it('should return a valid verification method', async () => {
    const key = Key.fromFingerprint(TEST_ED25519_FINGERPRINT)
    const verificationMethods = keyDidEd25519.getVerificationMethods(TEST_ED25519_DID, key)

    expect(JsonTransformer.toJSON(verificationMethods)).toMatchObject([didKeyEd25519Fixture.verificationMethod[0]])
  })

  it('supports Ed25519VerificationKey2018 verification method type', () => {
    expect(keyDidEd25519.supportedVerificationMethodTypes).toMatchObject(['Ed25519VerificationKey2018'])
  })

  it('returns key for Ed25519VerificationKey2018 verification method', () => {
    const verificationMethod = JsonTransformer.fromJSON(didKeyEd25519Fixture.verificationMethod[0], VerificationMethod)

    const key = keyDidEd25519.getKeyFromVerificationMethod(verificationMethod)

    expect(key.fingerprint).toBe(TEST_ED25519_FINGERPRINT)
  })

  it('throws an error if an invalid verification method is passed', () => {
    const verificationMethod = JsonTransformer.fromJSON(didKeyEd25519Fixture.verificationMethod[0], VerificationMethod)

    verificationMethod.type = 'SomeRandomType'

    expect(() => keyDidEd25519.getKeyFromVerificationMethod(verificationMethod)).toThrowError(
      'Invalid verification method passed'
    )
  })
})
