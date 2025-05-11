import { TypedArrayEncoder } from '@credo-ts/core'
import { PublicJwk } from '../../../PublicJwk'
import { X25519PublicJwk } from '../X25519PublicJwk'

const TEST_X25519_BASE58_KEY = '6fUMuABnqSDsaGKojbUF3P7ZkEL3wi2njsDdUWZGNgCU'
const TEST_X25519_FINGERPRINT = 'z6LShLeXRTzevtwcfehaGEzCMyL3bNsAeKCwcqwJxyCo63yE'

describe('X25519PublicJwk', () => {
  it('creates an X25519PublicJwk instance from public key bytes and x25519 key type', async () => {
    const publicJwk = PublicJwk.fromPublicKey({
      kty: 'OKP',
      crv: 'X25519',
      publicKey: TypedArrayEncoder.fromBase58(TEST_X25519_BASE58_KEY),
    })

    expect(publicJwk.fingerprint).toBe(TEST_X25519_FINGERPRINT)
  })

  it('creates a X25519PublicJwk instance from a fingerprint', async () => {
    const publicJwk = PublicJwk.fromFingerprint(TEST_X25519_FINGERPRINT)

    expect(publicJwk.fingerprint).toBe(TEST_X25519_FINGERPRINT)
  })

  it('should correctly calculate the getter properties', async () => {
    const publicJwk = PublicJwk.fromFingerprint(TEST_X25519_FINGERPRINT) as PublicJwk<X25519PublicJwk>

    expect(publicJwk.fingerprint).toBe(TEST_X25519_FINGERPRINT)
    expect(publicJwk.publicKey).toEqual({
      kty: 'OKP',
      crv: 'X25519',
      publicKey: Uint8Array.from(TypedArrayEncoder.fromBase58(TEST_X25519_BASE58_KEY)),
    })
    expect(publicJwk.toJson()).toEqual({
      kty: 'OKP',
      crv: 'X25519',
      x: TypedArrayEncoder.toBase64URL(TypedArrayEncoder.fromBase58(TEST_X25519_BASE58_KEY)),
    })
  })
})
