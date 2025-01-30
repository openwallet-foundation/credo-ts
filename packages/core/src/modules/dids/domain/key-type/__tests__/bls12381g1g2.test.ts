import { KeyType } from '../../../../../crypto'
import { Key } from '../../../../../crypto/Key'
import { Buffer, JsonTransformer, TypedArrayEncoder } from '../../../../../utils'
import keyBls12381g1g2Fixture from '../../../__tests__/__fixtures__/didKeyBls12381g1g2.json'
import { VerificationMethod } from '../../verificationMethod'
import { keyDidBls12381g1g2 } from '../bls12381g1g2'

const TEST_BLS12381G1G2_BASE58_KEY =
  'AQ4MiG1JKHmM5N4CgkF9uQ484PHN7gXB3ctF4ayL8hT6FdD6rcfFS3ZnMNntYsyJBckfNPf3HL8VU8jzgyT3qX88Yg3TeF2NkG2aZnJDNnXH1jkJStWMxjLw22LdphqAj1rSorsDhHjE8Rtz61bD6FP9aPokQUDVpZ4zXqsXVcxJ7YEc66TTLTTPwQPS7uNM4u2Fs'
const TEST_BLS12381G1G2_FINGERPRINT =
  'z5TcESXuYUE9aZWYwSdrUEGK1HNQFHyTt4aVpaCTVZcDXQmUheFwfNZmRksaAbBneNm5KyE52SdJeRCN1g6PJmF31GsHWwFiqUDujvasK3wTiDr3vvkYwEJHt7H5RGEKYEp1ErtQtcEBgsgY2DA9JZkHj1J9HZ8MRDTguAhoFtR4aTBQhgnkP4SwVbxDYMEZoF2TMYn3s'
const TEST_BLS12381G1G2_DID = `did:key:${TEST_BLS12381G1G2_FINGERPRINT}`

const TEST_BLS12381G1_BASE58_KEY = '7BVES4h78wzabPAfMhchXyH5d8EX78S5TtzePH2YkftWcE6by9yj3NTAv9nsyCeYch'
const TEST_BLS12381G1_FINGERPRINT = 'z3tEG5qmJZX29jJSX5kyhDR5YJNnefJFdwTxRqk6zbEPv4Pf2xF12BpmXv9NExxSRFGfxd'

const TEST_BLS12381G2_BASE58_KEY =
  '26d2BdqELsXg7ZHCWKL2D5Y2S7mYrpkdhJemSEEvokd4qy4TULJeeU44hYPGKo4x4DbBp5ARzkv1D6xuB3bmhpdpKAXuXtode67wzh9PCtW8kTqQhH19VSiFZkLNkhe9rtf3'
const TEST_BLS12381G2_FINGERPRINT =
  'zUC7LTa4hWtaE9YKyDsMVGiRNqPMN3s4rjBdB3MFi6PcVWReNfR72y3oGW2NhNcaKNVhMobh7aHp8oZB3qdJCs7RebM2xsodrSm8MmePbN25NTGcpjkJMwKbcWfYDX7eHCJjPGM'

const TEST_BLS12381G1G2_PREFIX_BYTES = Buffer.concat([
  new Uint8Array([238, 1]),
  TypedArrayEncoder.fromBase58(TEST_BLS12381G1G2_BASE58_KEY),
])

describe('bls12381g1g2', () => {
  it('creates a Key instance from public key bytes and bls12381g1g2 key type', async () => {
    const publicKeyBytes = TypedArrayEncoder.fromBase58(TEST_BLS12381G1G2_BASE58_KEY)

    const key = Key.fromPublicKey(publicKeyBytes, KeyType.Bls12381g1g2)

    expect(key.fingerprint).toBe(TEST_BLS12381G1G2_FINGERPRINT)
  })

  it('creates a Key instance from a base58 encoded public key and bls12381g1g2 key type', async () => {
    const key = Key.fromPublicKeyBase58(TEST_BLS12381G1G2_BASE58_KEY, KeyType.Bls12381g1g2)

    expect(key.fingerprint).toBe(TEST_BLS12381G1G2_FINGERPRINT)
  })

  it('creates a Key instance from a fingerprint', async () => {
    const key = Key.fromFingerprint(TEST_BLS12381G1G2_FINGERPRINT)

    expect(key.publicKeyBase58).toBe(TEST_BLS12381G1G2_BASE58_KEY)
  })

  it('should correctly calculate the getter properties', async () => {
    const key = Key.fromFingerprint(TEST_BLS12381G1G2_FINGERPRINT)

    expect(key.fingerprint).toBe(TEST_BLS12381G1G2_FINGERPRINT)
    expect(key.publicKeyBase58).toBe(TEST_BLS12381G1G2_BASE58_KEY)
    expect(key.publicKey).toEqual(Uint8Array.from(TypedArrayEncoder.fromBase58(TEST_BLS12381G1G2_BASE58_KEY)))
    expect(key.keyType).toBe(KeyType.Bls12381g1g2)
    expect(Buffer.from(key.prefixedPublicKey).equals(TEST_BLS12381G1G2_PREFIX_BYTES)).toBe(true)
  })

  it('should return a valid verification method', async () => {
    const key = Key.fromFingerprint(TEST_BLS12381G1G2_FINGERPRINT)
    const verificationMethods = keyDidBls12381g1g2.getVerificationMethods(TEST_BLS12381G1G2_DID, key)

    expect(JsonTransformer.toJSON(verificationMethods)).toMatchObject(keyBls12381g1g2Fixture.verificationMethod)
  })

  it('supports no verification method type', () => {
    // Verification methods can be handled by g1 or g2 key types. No reason to do it in here
    expect(keyDidBls12381g1g2.supportedVerificationMethodTypes).toMatchObject([])
  })

  it('throws an error for getKeyFromVerificationMethod as it is not supported for bls12381g1g2 key types', () => {
    const verificationMethod = JsonTransformer.fromJSON(
      keyBls12381g1g2Fixture.verificationMethod[0],
      VerificationMethod
    )

    expect(() => keyDidBls12381g1g2.getKeyFromVerificationMethod(verificationMethod)).toThrow(
      'Not supported for bls12381g1g2 key'
    )
  })

  it('should correctly go from g1g2 to g1', async () => {
    const g1g2Key = Key.fromFingerprint(TEST_BLS12381G1G2_FINGERPRINT)

    const g1PublicKey = g1g2Key.publicKey.slice(0, 48)
    const g1DidKey = Key.fromPublicKey(g1PublicKey, KeyType.Bls12381g1)

    expect(g1DidKey.fingerprint).toBe(TEST_BLS12381G1_FINGERPRINT)
    expect(g1DidKey.publicKeyBase58).toBe(TEST_BLS12381G1_BASE58_KEY)
    expect(g1DidKey.publicKey).toEqual(Uint8Array.from(TypedArrayEncoder.fromBase58(TEST_BLS12381G1_BASE58_KEY)))
    expect(g1DidKey.keyType).toBe(KeyType.Bls12381g1)
  })

  it('should correctly go from g1g2 to g2', async () => {
    const g1g2Key = Key.fromFingerprint(TEST_BLS12381G1G2_FINGERPRINT)

    const g2PublicKey = g1g2Key.publicKey.slice(48)
    const g2DidKey = Key.fromPublicKey(g2PublicKey, KeyType.Bls12381g2)

    expect(g2DidKey.fingerprint).toBe(TEST_BLS12381G2_FINGERPRINT)
    expect(g2DidKey.publicKeyBase58).toBe(TEST_BLS12381G2_BASE58_KEY)
    expect(g2DidKey.publicKey).toEqual(Uint8Array.from(TypedArrayEncoder.fromBase58(TEST_BLS12381G2_BASE58_KEY)))
    expect(g2DidKey.keyType).toBe(KeyType.Bls12381g2)
  })
})
