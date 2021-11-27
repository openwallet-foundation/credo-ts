import { BufferEncoder } from '../../../utils/BufferEncoder'
import { Buffer } from '../../../utils/buffer'
import { DidKey, KeyType } from '../DidKey'

import didKeyBls12381g1Fixture from './__fixtures__/didKeyBls12381g1.json'

const TEST_BLS12381G1_BASE58_KEY = '6FywSzB5BPd7xehCo1G4nYHAoZPMMP3gd4PLnvgA6SsTsogtz8K7RDznqLpFPLZXAE'
const TEST_BLS12381G1_FINGERPRINT = 'z3tEFALUKUzzCAvytMHX8X4SnsNsq6T5tC5Zb18oQEt1FqNcJXqJ3AA9umgzA9yoqPBeWA'
const TEST_BLS12381G1_DID = `did:key:${TEST_BLS12381G1_FINGERPRINT}`
const TEST_BLS12381G1_KEY_ID = `${TEST_BLS12381G1_DID}#${TEST_BLS12381G1_FINGERPRINT}`
const TEST_BLS12381G1_PREFIX_BYTES = Buffer.concat([
  new Uint8Array([234, 1]),
  BufferEncoder.fromBase58(TEST_BLS12381G1_BASE58_KEY),
])

describe('DidKey', () => {
  describe('bls12381g1', () => {
    it('should correctly create a DidKey instance from public key bytes and bls12381g1 key type', async () => {
      const publicKeyBytes = BufferEncoder.fromBase58(TEST_BLS12381G1_BASE58_KEY)

      const didKey = DidKey.fromPublicKey(publicKeyBytes, KeyType.BLS12381G1)

      expect(didKey.did).toBe(TEST_BLS12381G1_DID)
    })

    it('should correctly create a DidKey instance from a base58 encoded public key and bls12381g1 key type', async () => {
      const didKey = DidKey.fromPublicKeyBase58(TEST_BLS12381G1_BASE58_KEY, KeyType.BLS12381G1)

      expect(didKey.did).toBe(TEST_BLS12381G1_DID)
    })

    it('should correctly create a DidKey instance from a fingerprint', async () => {
      const didKey = DidKey.fromFingerprint(TEST_BLS12381G1_FINGERPRINT)

      expect(didKey.did).toBe(TEST_BLS12381G1_DID)
    })

    it('should correctly create a DidKey instance from a did', async () => {
      const didKey = DidKey.fromDid(TEST_BLS12381G1_DID)

      expect(didKey.publicKeyBase58).toBe(TEST_BLS12381G1_BASE58_KEY)
    })

    it('should correctly calculate the getter properties', async () => {
      const didKey = DidKey.fromDid(TEST_BLS12381G1_DID)

      expect(didKey.fingerprint).toBe(TEST_BLS12381G1_FINGERPRINT)
      expect(didKey.did).toBe(TEST_BLS12381G1_DID)
      expect(didKey.publicKeyBase58).toBe(TEST_BLS12381G1_BASE58_KEY)
      expect(didKey.publicKey).toEqual(BufferEncoder.fromBase58(TEST_BLS12381G1_BASE58_KEY))
      expect(didKey.keyType).toBe(KeyType.BLS12381G1)
      expect(didKey.keyId).toBe(TEST_BLS12381G1_KEY_ID)
      expect(didKey.prefixedPublicKey.equals(TEST_BLS12381G1_PREFIX_BYTES)).toBe(true)
    })

    it('should return a valid did:key did document for the did', async () => {
      const didKey = DidKey.fromDid(TEST_BLS12381G1_DID)

      expect(didKey.didDocument).toEqual(didKeyBls12381g1Fixture)
    })
  })
})
