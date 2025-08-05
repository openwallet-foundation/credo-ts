import { TypedArrayEncoder } from '@credo-ts/core'
import { PublicJwk } from '../../../PublicJwk'
import { Ed25519PublicJwk } from '../Ed25519PublicJwk'

const TEST_ED25519_BASE58_KEY = '8HH5gYEeNc3z7PYXmd54d4x6qAfCNrqQqEB3nS7Zfu7K'
const TEST_ED25519_FINGERPRINT = 'z6MkmjY8GnV5i9YTDtPETC2uUAW6ejw3nk5mXF5yci5ab7th'

describe('Ed25519PublicJwk', () => {
  it('creates an Ed25519PublicJwk instance from public key bytes and ed25519 key type', async () => {
    const publicJwk = PublicJwk.fromPublicKey({
      kty: 'OKP',
      crv: 'Ed25519',
      publicKey: TypedArrayEncoder.fromBase58(TEST_ED25519_BASE58_KEY),
    })

    expect(publicJwk.fingerprint).toBe(TEST_ED25519_FINGERPRINT)
  })

  it('creates a Ed25519PublicJwk instance from a fingerprint', async () => {
    const publicJwk = PublicJwk.fromFingerprint(TEST_ED25519_FINGERPRINT)

    expect(publicJwk.fingerprint).toBe(TEST_ED25519_FINGERPRINT)
  })

  it('should correctly calculate the getter properties', async () => {
    const publicJwk = PublicJwk.fromFingerprint(TEST_ED25519_FINGERPRINT) as PublicJwk<Ed25519PublicJwk>

    expect(publicJwk.fingerprint).toBe(TEST_ED25519_FINGERPRINT)
    expect(publicJwk.publicKey).toEqual({
      kty: 'OKP',
      crv: 'Ed25519',
      publicKey: Uint8Array.from(TypedArrayEncoder.fromBase58(TEST_ED25519_BASE58_KEY)),
    })
    expect(publicJwk.toJson()).toEqual({
      kty: 'OKP',
      crv: 'Ed25519',
      x: TypedArrayEncoder.toBase64URL(TypedArrayEncoder.fromBase58(TEST_ED25519_BASE58_KEY)),
    })
  })
})
