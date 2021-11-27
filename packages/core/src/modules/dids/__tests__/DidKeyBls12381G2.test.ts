import { BufferEncoder } from '../../../utils/BufferEncoder'
import { Buffer } from '../../../utils/buffer'
import { DidKey, KeyType } from '../DidKey'

import didKeyBls12381g2Fixture from './__fixtures__/didKeyBls12381g2.json'

const TEST_BLS12381G2_BASE58_KEY =
  'mxE4sHTpbPcmxNviRVR9r7D2taXcNyVJmf9TBUFS1gRt3j3Ej9Seo59GQeCzYwbQgDrfWCwEJvmBwjLvheAky5N2NqFVzk4kuq3S8g4Fmekai4P622vHqWjFrsioYYDqhf9'
const TEST_BLS12381G2_FINGERPRINT =
  'zUC71nmwvy83x1UzNKbZbS7N9QZx8rqpQx3Ee3jGfKiEkZngTKzsRoqobX6wZdZF5F93pSGYYco3gpK9tc53ruWUo2tkBB9bxPCFBUjq2th8FbtT4xih6y6Q1K9EL4Th86NiCGT'
const TEST_BLS12381G2_DID = `did:key:${TEST_BLS12381G2_FINGERPRINT}`
const TEST_BLS12381G2_KEY_ID = `${TEST_BLS12381G2_DID}#${TEST_BLS12381G2_FINGERPRINT}`
const TEST_BLS12381G2_PREFIX_BYTES = Buffer.concat([
  new Uint8Array([235, 1]),
  BufferEncoder.fromBase58(TEST_BLS12381G2_BASE58_KEY),
])

describe('DidKey', () => {
  describe('bls12381g2', () => {
    it('should correctly create a DidKey instance from public key bytes and bls12381g2 key type', async () => {
      const publicKeyBytes = BufferEncoder.fromBase58(TEST_BLS12381G2_BASE58_KEY)

      const didKey = DidKey.fromPublicKey(publicKeyBytes, KeyType.BLS12381G2)

      expect(didKey.did).toBe(TEST_BLS12381G2_DID)
    })

    it('should correctly create a DidKey instance from a base58 encoded public key and bls12381g2 key type', async () => {
      const didKey = DidKey.fromPublicKeyBase58(TEST_BLS12381G2_BASE58_KEY, KeyType.BLS12381G2)

      expect(didKey.did).toBe(TEST_BLS12381G2_DID)
    })

    it('should correctly create a DidKey instance from a fingerprint', async () => {
      const didKey = DidKey.fromFingerprint(TEST_BLS12381G2_FINGERPRINT)

      expect(didKey.did).toBe(TEST_BLS12381G2_DID)
    })

    it('should correctly create a DidKey instance from a did', async () => {
      const didKey = DidKey.fromDid(TEST_BLS12381G2_DID)

      expect(didKey.publicKeyBase58).toBe(TEST_BLS12381G2_BASE58_KEY)
    })

    it('should correctly calculate the getter properties', async () => {
      const didKey = DidKey.fromDid(TEST_BLS12381G2_DID)

      expect(didKey.fingerprint).toBe(TEST_BLS12381G2_FINGERPRINT)
      expect(didKey.did).toBe(TEST_BLS12381G2_DID)
      expect(didKey.publicKeyBase58).toBe(TEST_BLS12381G2_BASE58_KEY)
      expect(didKey.publicKey).toEqual(BufferEncoder.fromBase58(TEST_BLS12381G2_BASE58_KEY))
      expect(didKey.keyType).toBe(KeyType.BLS12381G2)
      expect(didKey.keyId).toBe(TEST_BLS12381G2_KEY_ID)
      expect(didKey.prefixedPublicKey.equals(TEST_BLS12381G2_PREFIX_BYTES)).toBe(true)
    })

    it('should return a valid did:key did document for the did', async () => {
      const didKey = DidKey.fromDid(TEST_BLS12381G2_DID)

      expect(didKey.didDocument).toEqual(didKeyBls12381g2Fixture)
    })
  })
})
