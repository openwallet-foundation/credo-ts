import { KeyManagementError } from '../../error/KeyManagementError'
import { AkpPublicJwk } from '../kty'
import { PublicJwk } from '../PublicJwk'

describe('PublicJwk AKP support', () => {
  test.each(['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'] as const)('parses and serializes %s JWKs', (alg) => {
    const jwk = { kty: 'AKP', alg, pub: 'cHVibGlj' } as const
    const publicJwk = PublicJwk.fromUnknown(jwk)

    expect(publicJwk.JwkClass).toBe(AkpPublicJwk)
    expect(publicJwk.toJson()).toEqual(jwk)
    expect(publicJwk.supportedSignatureAlgorithms).toEqual([alg])
    expect(publicJwk.signatureAlgorithm).toBe(alg)
    expect(PublicJwk.supportedPublicJwkClassForSignatureAlgorithm(alg)).toBe(AkpPublicJwk)
  })

  test.each(['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'] as const)('clones and compares %s JWKs', (alg) => {
    const publicJwk = PublicJwk.fromUnknown({ kty: 'AKP', alg, pub: 'cHVibGlj' })
    const clone = publicJwk.clone()

    expect(clone).not.toBe(publicJwk)
    expect(clone.toJson()).toEqual(publicJwk.toJson())
    expect(clone.equals(publicJwk)).toBe(true)
    expect(clone.equals(PublicJwk.fromUnknown({ kty: 'AKP', alg, pub: 'b3RoZXI' }))).toBe(false)
  })

  test('rejects setting an algorithm not supported by the AKP key', () => {
    const publicJwk = PublicJwk.fromUnknown({ kty: 'AKP', alg: 'ML-DSA-44', pub: 'cHVibGlj' })

    expect(() => {
      publicJwk.alg = 'ML-DSA-65'
    }).toThrow(KeyManagementError)
    expect(() => publicJwk.assertSignatureAlgorithmSupported('ML-DSA-65')).toThrow(KeyManagementError)
  })

  test('rejects AKP byte-key and identity operations clearly', () => {
    const publicJwk = PublicJwk.fromUnknown({ kty: 'AKP', alg: 'ML-DSA-44', pub: 'cHVibGlj' })

    expect(() => publicJwk.publicKey).toThrow(KeyManagementError)
    expect(() => publicJwk.compressedPublicKey).toThrow(KeyManagementError)
    expect(() => publicJwk.fingerprint).toThrow(KeyManagementError)
    expect(() => publicJwk.legacyKeyId).toThrow(KeyManagementError)
  })

  test('rejects AKP thumbprints explicitly', () => {
    const publicJwk = PublicJwk.fromUnknown({ kty: 'AKP', alg: 'ML-DSA-44', pub: 'cHVibGlj' })

    expect(() => publicJwk.getJwkThumbprint()).toThrow('JWK thumbprints are not supported for AKP JWKs')
  })

  test('does not parse AKP JWKs without a valid algorithm', () => {
    expect(() => PublicJwk.fromUnknown({ kty: 'AKP', pub: 'cHVibGlj' })).toThrow()
    expect(() => PublicJwk.fromUnknown({ kty: 'AKP', alg: 'invalid', pub: 'cHVibGlj' })).toThrow()
  })
})
