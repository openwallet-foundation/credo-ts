import { KeyType } from '../../../../../crypto'
import { JsonTransformer, BufferEncoder, Buffer } from '../../../../../utils'
import didKeyX25519Fixture from '../../../__tests__/__fixtures__/didKeyX25519.json'
import { Key } from '../../Key'
import { VerificationMethod } from '../../verificationMethod'
import { keyDidX25519 } from '../x25519'

const TEST_X25519_BASE58_KEY = '6fUMuABnqSDsaGKojbUF3P7ZkEL3wi2njsDdUWZGNgCU'
const TEST_X25519_FINGERPRINT = 'z6LShLeXRTzevtwcfehaGEzCMyL3bNsAeKCwcqwJxyCo63yE'
const TEST_X25519_DID = `did:key:${TEST_X25519_FINGERPRINT}`
const TEST_X25519_PREFIX_BYTES = Buffer.concat([
  new Uint8Array([236, 1]),
  BufferEncoder.fromBase58(TEST_X25519_BASE58_KEY),
])

describe('x25519', () => {
  it('creates a Key instance from public key bytes and x25519 key type', async () => {
    const publicKeyBytes = BufferEncoder.fromBase58(TEST_X25519_BASE58_KEY)

    const didKey = Key.fromPublicKey(publicKeyBytes, KeyType.X25519)

    expect(didKey.fingerprint).toBe(TEST_X25519_FINGERPRINT)
  })

  it('creates a Key instance from a base58 encoded public key and x25519 key type', async () => {
    const didKey = Key.fromPublicKeyBase58(TEST_X25519_BASE58_KEY, KeyType.X25519)

    expect(didKey.fingerprint).toBe(TEST_X25519_FINGERPRINT)
  })

  it('creates a Key instance from a fingerprint', async () => {
    const didKey = Key.fromFingerprint(TEST_X25519_FINGERPRINT)

    expect(didKey.fingerprint).toBe(TEST_X25519_FINGERPRINT)
  })

  it('should correctly calculate the getter properties', async () => {
    const didKey = Key.fromFingerprint(TEST_X25519_FINGERPRINT)

    expect(didKey.fingerprint).toBe(TEST_X25519_FINGERPRINT)
    expect(didKey.publicKeyBase58).toBe(TEST_X25519_BASE58_KEY)
    expect(didKey.publicKey).toEqual(BufferEncoder.fromBase58(TEST_X25519_BASE58_KEY))
    expect(didKey.keyType).toBe(KeyType.X25519)
    expect(didKey.prefixedPublicKey.equals(TEST_X25519_PREFIX_BYTES)).toBe(true)
  })

  it('should return a valid did:key did document for the did', async () => {
    const key = Key.fromFingerprint(TEST_X25519_FINGERPRINT)
    const didDocument = keyDidX25519.getDidDocument(TEST_X25519_DID, key)

    expect(JsonTransformer.toJSON(didDocument)).toMatchObject(didKeyX25519Fixture)
  })

  it('should return a valid verification method', async () => {
    const key = Key.fromFingerprint(TEST_X25519_FINGERPRINT)
    const verificationMethods = keyDidX25519.getVerificationMethods(TEST_X25519_DID, key)

    expect(JsonTransformer.toJSON(verificationMethods)).toMatchObject([didKeyX25519Fixture.keyAgreement[0]])
  })

  it('supports X25519KeyAgreementKey2019 verification method type', () => {
    expect(keyDidX25519.supportedVerificationMethodTypes).toMatchObject(['X25519KeyAgreementKey2019'])
  })

  it('returns key for X25519KeyAgreementKey2019 verification method', () => {
    const verificationMethod = JsonTransformer.fromJSON(didKeyX25519Fixture.keyAgreement[0], VerificationMethod)

    const key = keyDidX25519.getKeyFromVerificationMethod(verificationMethod)

    expect(key.fingerprint).toBe(TEST_X25519_FINGERPRINT)
  })

  it('throws an error if an invalid verification method is passed', () => {
    const verificationMethod = JsonTransformer.fromJSON(didKeyX25519Fixture.keyAgreement[0], VerificationMethod)

    verificationMethod.type = 'SomeRandomType'

    expect(() => keyDidX25519.getKeyFromVerificationMethod(verificationMethod)).toThrowError(
      'Invalid verification method passed'
    )
  })
})
