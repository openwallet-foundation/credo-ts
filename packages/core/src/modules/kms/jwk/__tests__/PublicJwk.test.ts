import { MultiBaseEncoder, TypedArrayEncoder, VarintEncoder } from '../../../../utils'
import { KeyManagementError } from '../../error/KeyManagementError'
import { MlDsa44PublicJwk, MlDsa65PublicJwk, MlDsa87PublicJwk } from '../kty'
import { PublicJwk } from '../PublicJwk'

describe('PublicJwk AKP support', () => {
  test.each([
    ['ML-DSA-44', MlDsa44PublicJwk],
    ['ML-DSA-65', MlDsa65PublicJwk],
    ['ML-DSA-87', MlDsa87PublicJwk],
  ] as const)('parses and serializes %s JWKs', (alg, jwkClass) => {
    const jwk = { kty: 'AKP', alg, pub: 'cHVibGlj' } as const
    const publicJwk = PublicJwk.fromUnknown(jwk)

    expect(publicJwk.JwkClass).toBe(jwkClass)
    expect(publicJwk.toJson()).toEqual(jwk)
    expect(publicJwk.supportedSignatureAlgorithms).toEqual([alg])
    expect(publicJwk.signatureAlgorithm).toBe(alg)
    expect(PublicJwk.supportedPublicJwkClassForSignatureAlgorithm(alg)).toBe(jwkClass)
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

  test.each([
    { alg: 'ML-DSA-44', prefix: 0x1210, length: 1312 },
    { alg: 'ML-DSA-65', prefix: 0x1211, length: 1952 },
    { alg: 'ML-DSA-87', prefix: 0x1212, length: 2592 },
  ] as const)('encodes and decodes $alg Multikey fingerprints', ({ alg, prefix, length }) => {
    const rawPublicKey = new Uint8Array(length).fill(0x42)
    const publicJwk = PublicJwk.fromUnknown({ kty: 'AKP', alg, pub: TypedArrayEncoder.toBase64Url(rawPublicKey) })
    const expectedFingerprint = MultiBaseEncoder.encode(
      TypedArrayEncoder.concat([VarintEncoder.encode(prefix), rawPublicKey]),
      'base64url'
    )

    expect(publicJwk.fingerprint).toBe(expectedFingerprint)
    const decodedPublicJwk = PublicJwk.fromFingerprint(expectedFingerprint)
    expect(decodedPublicJwk.toJson()).toEqual(publicJwk.toJson())
    expect(decodedPublicJwk.JwkClass).toBe(publicJwk.JwkClass)
    expect(decodedPublicJwk.JwkClass.multicodecPrefix).toBe(prefix)
    expect(decodedPublicJwk.supportedSignatureAlgorithms).toEqual([alg])
  })

  test('decodes a base64url multibase ML-DSA-44 Multikey fingerprint', () => {
    const rawPublicKey = new Uint8Array(1312).fill(0x42)
    const fingerprint = MultiBaseEncoder.encode(
      TypedArrayEncoder.concat([VarintEncoder.encode(0x1210), rawPublicKey]),
      'base64url'
    )

    const publicJwk = PublicJwk.fromFingerprint(fingerprint)

    expect(fingerprint[0]).toBe('u')
    expect(publicJwk.toJson()).toEqual({
      kty: 'AKP',
      alg: 'ML-DSA-44',
      pub: TypedArrayEncoder.toBase64Url(rawPublicKey),
    })
  })

  test('rejects base58btc multibase for AKP fingerprints', () => {
    const fingerprint = MultiBaseEncoder.encode(
      TypedArrayEncoder.concat([VarintEncoder.encode(0x1210), new Uint8Array(1312).fill(0x42)]),
      'base58btc'
    )

    expect(() => PublicJwk.fromFingerprint(fingerprint)).toThrow('Unsupported multibase')
  })

  test.each([
    { alg: 'ML-DSA-44', length: 1311 },
    { alg: 'ML-DSA-65', length: 1953 },
    { alg: 'ML-DSA-87', length: 2591 },
  ] as const)('rejects invalid Multikey public key length for $alg', ({ alg, length }) => {
    const publicJwk = PublicJwk.fromUnknown({
      kty: 'AKP',
      alg,
      pub: TypedArrayEncoder.toBase64Url(new Uint8Array(length)),
    })

    expect(() => publicJwk.fingerprint).toThrow('Invalid public key length')
  })

  test('rejects AKP byte-key and identity operations clearly', () => {
    const publicJwk = PublicJwk.fromUnknown({
      kty: 'AKP',
      alg: 'ML-DSA-44',
      pub: TypedArrayEncoder.toBase64Url(new Uint8Array(1312)),
    })

    expect(() => publicJwk.publicKey).toThrow(KeyManagementError)
    expect(() => publicJwk.compressedPublicKey).toThrow(KeyManagementError)
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
