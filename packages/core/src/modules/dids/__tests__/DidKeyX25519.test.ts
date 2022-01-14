import { BufferEncoder } from '../../../utils/BufferEncoder'
import { JsonTransformer } from '../../../utils/JsonTransformer'
import { Buffer } from '../../../utils/buffer'
import { DidKey, KeyType } from '../domain/DidKey'

import didKeyX25519Fixture from './__fixtures__/didKeyX25519.json'

const TEST_X25519_BASE58_KEY = '6fUMuABnqSDsaGKojbUF3P7ZkEL3wi2njsDdUWZGNgCU'
const TEST_X25519_FINGERPRINT = 'z6LShLeXRTzevtwcfehaGEzCMyL3bNsAeKCwcqwJxyCo63yE'
const TEST_X25519_DID = `did:key:${TEST_X25519_FINGERPRINT}`
const TEST_X25519_KEY_ID = `${TEST_X25519_DID}#${TEST_X25519_FINGERPRINT}`
const TEST_X25519_PREFIX_BYTES = Buffer.concat([
  new Uint8Array([236, 1]),
  BufferEncoder.fromBase58(TEST_X25519_BASE58_KEY),
])

describe('DidKey', () => {
  describe('x25519', () => {
    it('creates a DidKey instance from public key bytes and x25519 key type', async () => {
      const publicKeyBytes = BufferEncoder.fromBase58(TEST_X25519_BASE58_KEY)

      const didKey = DidKey.fromPublicKey(publicKeyBytes, KeyType.X25519)

      expect(didKey.did).toBe(TEST_X25519_DID)
    })

    it('creates a DidKey instance from a base58 encoded public key and x25519 key type', async () => {
      const didKey = DidKey.fromPublicKeyBase58(TEST_X25519_BASE58_KEY, KeyType.X25519)

      expect(didKey.did).toBe(TEST_X25519_DID)
    })

    it('creates a DidKey instance from a fingerprint', async () => {
      const didKey = DidKey.fromFingerprint(TEST_X25519_FINGERPRINT)

      expect(didKey.did).toBe(TEST_X25519_DID)
    })

    it('creates a DidKey instance from a did', async () => {
      const didKey = DidKey.fromDid(TEST_X25519_DID)

      expect(didKey.publicKeyBase58).toBe(TEST_X25519_BASE58_KEY)
    })

    it('should correctly calculate the getter properties', async () => {
      const didKey = DidKey.fromDid(TEST_X25519_DID)

      expect(didKey.fingerprint).toBe(TEST_X25519_FINGERPRINT)
      expect(didKey.did).toBe(TEST_X25519_DID)
      expect(didKey.publicKeyBase58).toBe(TEST_X25519_BASE58_KEY)
      expect(didKey.publicKey).toEqual(BufferEncoder.fromBase58(TEST_X25519_BASE58_KEY))
      expect(didKey.keyType).toBe(KeyType.X25519)
      expect(didKey.keyId).toBe(TEST_X25519_KEY_ID)
      expect(didKey.prefixedPublicKey.equals(TEST_X25519_PREFIX_BYTES)).toBe(true)
    })

    it('should return a valid did:key did document for the did', async () => {
      const didKey = DidKey.fromDid(TEST_X25519_DID)

      expect(JsonTransformer.toJSON(didKey.didDocument)).toMatchObject(didKeyX25519Fixture)
    })
  })
})
