import { BufferEncoder } from '../../../utils/BufferEncoder'
import { Buffer } from '../../../utils/buffer'
import { DidKey, KeyType } from '../DidKey'

import didKeyBls12381g1g2Fixture from './__fixtures__/didKeyBls12381g1g2.json'

const TEST_BLS12381G1G2_BASE58_KEY =
  'AQ4MiG1JKHmM5N4CgkF9uQ484PHN7gXB3ctF4ayL8hT6FdD6rcfFS3ZnMNntYsyJBckfNPf3HL8VU8jzgyT3qX88Yg3TeF2NkG2aZnJDNnXH1jkJStWMxjLw22LdphqAj1rSorsDhHjE8Rtz61bD6FP9aPokQUDVpZ4zXqsXVcxJ7YEc66TTLTTPwQPS7uNM4u2Fs'
const TEST_BLS12381G1G2_FINGERPRINT =
  'z5TcESXuYUE9aZWYwSdrUEGK1HNQFHyTt4aVpaCTVZcDXQmUheFwfNZmRksaAbBneNm5KyE52SdJeRCN1g6PJmF31GsHWwFiqUDujvasK3wTiDr3vvkYwEJHt7H5RGEKYEp1ErtQtcEBgsgY2DA9JZkHj1J9HZ8MRDTguAhoFtR4aTBQhgnkP4SwVbxDYMEZoF2TMYn3s'
const TEST_BLS12381G1G2_DID = `did:key:${TEST_BLS12381G1G2_FINGERPRINT}`

const TEST_BLS12381G1_BASE58_KEY = '7BVES4h78wzabPAfMhchXyH5d8EX78S5TtzePH2YkftWcE6by9yj3NTAv9nsyCeYch'
const TEST_BLS12381G1_FINGERPRINT = 'z3tEG5qmJZX29jJSX5kyhDR5YJNnefJFdwTxRqk6zbEPv4Pf2xF12BpmXv9NExxSRFGfxd'
const TEST_BLS12381G1_DID = `did:key:${TEST_BLS12381G1_FINGERPRINT}`

const TEST_BLS12381G2_BASE58_KEY =
  '26d2BdqELsXg7ZHCWKL2D5Y2S7mYrpkdhJemSEEvokd4qy4TULJeeU44hYPGKo4x4DbBp5ARzkv1D6xuB3bmhpdpKAXuXtode67wzh9PCtW8kTqQhH19VSiFZkLNkhe9rtf3'
const TEST_BLS12381G2_FINGERPRINT =
  'zUC7LTa4hWtaE9YKyDsMVGiRNqPMN3s4rjBdB3MFi6PcVWReNfR72y3oGW2NhNcaKNVhMobh7aHp8oZB3qdJCs7RebM2xsodrSm8MmePbN25NTGcpjkJMwKbcWfYDX7eHCJjPGM'
const TEST_BLS12381G2_DID = `did:key:${TEST_BLS12381G2_FINGERPRINT}`

const TEST_BLS12381G1G2_PREFIX_BYTES = Buffer.concat([
  new Uint8Array([238, 1]),
  BufferEncoder.fromBase58(TEST_BLS12381G1G2_BASE58_KEY),
])

describe('DidKey', () => {
  describe('bls12381g1g2', () => {
    it('should correctly create a DidKey instance from public key bytes and bls12381g1g2 key type', async () => {
      const publicKeyBytes = BufferEncoder.fromBase58(TEST_BLS12381G1G2_BASE58_KEY)

      const didKey = DidKey.fromPublicKey(publicKeyBytes, KeyType.BLS12381G1G2)

      expect(didKey.did).toBe(TEST_BLS12381G1G2_DID)
    })

    it('should correctly create a DidKey instance from a base58 encoded public key and bls12381g1g2 key type', async () => {
      const didKey = DidKey.fromPublicKeyBase58(TEST_BLS12381G1G2_BASE58_KEY, KeyType.BLS12381G1G2)

      expect(didKey.did).toBe(TEST_BLS12381G1G2_DID)
    })

    it('should correctly create a DidKey instance from a fingerprint', async () => {
      const didKey = DidKey.fromFingerprint(TEST_BLS12381G1G2_FINGERPRINT)

      expect(didKey.did).toBe(TEST_BLS12381G1G2_DID)
    })

    it('should correctly create a DidKey instance from a did', async () => {
      const didKey = DidKey.fromDid(TEST_BLS12381G1G2_DID)

      expect(didKey.publicKeyBase58).toBe(TEST_BLS12381G1G2_BASE58_KEY)
    })

    it('should correctly calculate the getter properties', async () => {
      const didKey = DidKey.fromDid(TEST_BLS12381G1G2_DID)

      expect(didKey.fingerprint).toBe(TEST_BLS12381G1G2_FINGERPRINT)
      expect(didKey.did).toBe(TEST_BLS12381G1G2_DID)
      expect(didKey.publicKeyBase58).toBe(TEST_BLS12381G1G2_BASE58_KEY)
      expect(didKey.publicKey).toEqual(BufferEncoder.fromBase58(TEST_BLS12381G1G2_BASE58_KEY))
      expect(didKey.keyType).toBe(KeyType.BLS12381G1G2)
      expect(didKey.prefixedPublicKey.equals(TEST_BLS12381G1G2_PREFIX_BYTES)).toBe(true)
    })

    it('should return a valid did:key did document for the did', async () => {
      const didKey = DidKey.fromDid(TEST_BLS12381G1G2_DID)

      expect(didKey.didDocument).toEqual(didKeyBls12381g1g2Fixture)
    })

    it('should correctly go from g1g2 to g1', async () => {
      const g1g2DidKey = DidKey.fromDid(TEST_BLS12381G1G2_DID)

      const g1PublicKey = g1g2DidKey.publicKey.slice(0, 48)
      const g1DidKey = DidKey.fromPublicKey(g1PublicKey, KeyType.BLS12381G1)

      expect(g1DidKey.fingerprint).toBe(TEST_BLS12381G1_FINGERPRINT)
      expect(g1DidKey.did).toBe(TEST_BLS12381G1_DID)
      expect(g1DidKey.publicKeyBase58).toBe(TEST_BLS12381G1_BASE58_KEY)
      expect(g1DidKey.publicKey).toEqual(BufferEncoder.fromBase58(TEST_BLS12381G1_BASE58_KEY))
      expect(g1DidKey.keyType).toBe(KeyType.BLS12381G1)
    })

    it('should correctly go from g1g2 to g2', async () => {
      const g1g2DidKey = DidKey.fromDid(TEST_BLS12381G1G2_DID)

      const g2PublicKey = g1g2DidKey.publicKey.slice(48)
      const g2DidKey = DidKey.fromPublicKey(g2PublicKey, KeyType.BLS12381G2)

      expect(g2DidKey.fingerprint).toBe(TEST_BLS12381G2_FINGERPRINT)
      expect(g2DidKey.did).toBe(TEST_BLS12381G2_DID)
      expect(g2DidKey.publicKeyBase58).toBe(TEST_BLS12381G2_BASE58_KEY)
      expect(g2DidKey.publicKey).toEqual(BufferEncoder.fromBase58(TEST_BLS12381G2_BASE58_KEY))
      expect(g2DidKey.keyType).toBe(KeyType.BLS12381G2)
    })
  })
})
