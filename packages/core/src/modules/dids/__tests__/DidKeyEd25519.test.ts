import { BufferEncoder } from '../../../utils/BufferEncoder'
import { JsonTransformer } from '../../../utils/JsonTransformer'
import { Buffer } from '../../../utils/buffer'
import { DidKey, KeyType } from '../domain/DidKey'

import didKeyEd25519Fixture from './__fixtures__/didKeyEd25519.json'

const TEST_ED25519_BASE58_KEY = '8HH5gYEeNc3z7PYXmd54d4x6qAfCNrqQqEB3nS7Zfu7K'
const TEST_ED25519_FINGERPRINT = 'z6MkmjY8GnV5i9YTDtPETC2uUAW6ejw3nk5mXF5yci5ab7th'
const TEST_ED25519_DID = `did:key:${TEST_ED25519_FINGERPRINT}`
const TEST_ED25519_KEY_ID = `${TEST_ED25519_DID}#${TEST_ED25519_FINGERPRINT}`
const TEST_ED25519_PREFIX_BYTES = Buffer.concat([
  new Uint8Array([237, 1]),
  BufferEncoder.fromBase58(TEST_ED25519_BASE58_KEY),
])

describe('DidKey', () => {
  describe('ed25519', () => {
    it('creates a DidKey instance from public key bytes and ed25519 key type', async () => {
      const publicKeyBytes = BufferEncoder.fromBase58(TEST_ED25519_BASE58_KEY)

      const didKey = DidKey.fromPublicKey(publicKeyBytes, KeyType.ED25519)

      expect(didKey.did).toBe(TEST_ED25519_DID)
    })

    it('creates a DidKey instance from a base58 encoded public key and ed25519 key type', async () => {
      const didKey = DidKey.fromPublicKeyBase58(TEST_ED25519_BASE58_KEY, KeyType.ED25519)

      expect(didKey.did).toBe(TEST_ED25519_DID)
    })

    it('creates a DidKey instance from a fingerprint', async () => {
      const didKey = DidKey.fromFingerprint(TEST_ED25519_FINGERPRINT)

      expect(didKey.did).toBe(TEST_ED25519_DID)
    })

    it('creates a DidKey instance from a did', async () => {
      const didKey = DidKey.fromDid(TEST_ED25519_DID)

      expect(didKey.publicKeyBase58).toBe(TEST_ED25519_BASE58_KEY)
    })

    it('should correctly calculate the getter properties', async () => {
      const didKey = DidKey.fromDid(TEST_ED25519_DID)

      expect(didKey.fingerprint).toBe(TEST_ED25519_FINGERPRINT)
      expect(didKey.did).toBe(TEST_ED25519_DID)
      expect(didKey.publicKeyBase58).toBe(TEST_ED25519_BASE58_KEY)
      expect(didKey.publicKey).toEqual(BufferEncoder.fromBase58(TEST_ED25519_BASE58_KEY))
      expect(didKey.keyType).toBe(KeyType.ED25519)
      expect(didKey.keyId).toBe(TEST_ED25519_KEY_ID)
      expect(didKey.prefixedPublicKey.equals(TEST_ED25519_PREFIX_BYTES)).toBe(true)
    })

    it('should return a valid did:key did document for the did', async () => {
      const didKey = DidKey.fromDid(TEST_ED25519_DID)

      expect(JsonTransformer.toJSON(didKey.didDocument)).toMatchObject(didKeyEd25519Fixture)
    })
  })
})
