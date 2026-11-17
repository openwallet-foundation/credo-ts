import { TypedArrayEncoder } from '../../../../../utils'
import { KeyManagementError } from '../../../error/KeyManagementError'
import { isKnownJwaSignatureAlgorithm } from '../../jwa'
import type { KmsJwkPublicEc } from '../../kty/ec/ecJwk'
import type { KmsJwkPrivateOct } from '../../kty/oct/octJwk'
import type { KmsJwkPublicOkp } from '../../kty/okp/okpJwk'
import type { KmsJwkPublicRsa } from '../../kty/rsa/rsaJwk'
import {
  allowedSigningAlgsForSigningKey,
  assertAllowedSigningAlgForKey,
  createKeyTypeForSigningAlgorithm,
  supportedSigningAlgsForKey,
} from '../signing'

const p256PublicJwk: KmsJwkPublicEc = { kty: 'EC', crv: 'P-256', x: 'x', y: 'y' }
const p384PublicJwk: KmsJwkPublicEc = { kty: 'EC', crv: 'P-384', x: 'x', y: 'y' }
const p521PublicJwk: KmsJwkPublicEc = { kty: 'EC', crv: 'P-521', x: 'x', y: 'y' }
const secp256k1PublicJwk: KmsJwkPublicEc = { kty: 'EC', crv: 'secp256k1', x: 'x', y: 'y' }
const ed25519PublicJwk: KmsJwkPublicOkp = { kty: 'OKP', crv: 'Ed25519', x: 'x' }
const x25519PublicJwk: KmsJwkPublicOkp = { kty: 'OKP', crv: 'X25519', x: 'x' }

function rsaPublicJwkWithModulusBytes(modulusBytes: number): KmsJwkPublicRsa {
  return { kty: 'RSA', n: TypedArrayEncoder.toBase64Url(new Uint8Array(modulusBytes)), e: 'AQAB' }
}

function octPrivateJwkWithKeyBytes(keyBytes: number): KmsJwkPrivateOct {
  return { kty: 'oct', k: TypedArrayEncoder.toBase64Url(new Uint8Array(keyBytes)) }
}

describe('signing algorithm support', () => {
  describe('supportedSigningAlgsForKey', () => {
    test('maps each elliptic curve to its single signature algorithm', () => {
      expect(supportedSigningAlgsForKey(p256PublicJwk)).toEqual(['ES256'])
      expect(supportedSigningAlgsForKey(p384PublicJwk)).toEqual(['ES384'])
      expect(supportedSigningAlgsForKey(p521PublicJwk)).toEqual(['ES512'])
      expect(supportedSigningAlgsForKey(secp256k1PublicJwk)).toEqual(['ES256K'])
    })

    test('maps an Ed25519 key to both the EdDSA and Ed25519 algorithm identifiers', () => {
      expect(supportedSigningAlgsForKey(ed25519PublicJwk)).toEqual(['EdDSA', 'Ed25519'])
    })

    test('returns no algorithms for an X25519 key agreement key', () => {
      expect(supportedSigningAlgsForKey(x25519PublicJwk)).toEqual([])
    })

    test('selects RSA algorithms based on the modulus bit length', () => {
      expect(supportedSigningAlgsForKey(rsaPublicJwkWithModulusBytes(256))).toEqual(['PS256', 'RS256'])
      expect(supportedSigningAlgsForKey(rsaPublicJwkWithModulusBytes(384))).toEqual([
        'PS256',
        'RS256',
        'RS384',
        'PS384',
      ])
      expect(supportedSigningAlgsForKey(rsaPublicJwkWithModulusBytes(512))).toEqual([
        'PS256',
        'RS256',
        'RS384',
        'PS384',
        'RS512',
        'PS512',
      ])
    })

    test('returns no algorithms for an RSA key below the 2048 bit minimum', () => {
      expect(supportedSigningAlgsForKey(rsaPublicJwkWithModulusBytes(128))).toEqual([])
    })

    test('selects HMAC algorithms based on the oct key bit length', () => {
      expect(supportedSigningAlgsForKey(octPrivateJwkWithKeyBytes(32))).toEqual(['HS256'])
      expect(supportedSigningAlgsForKey(octPrivateJwkWithKeyBytes(48))).toEqual(['HS256', 'HS384'])
      expect(supportedSigningAlgsForKey(octPrivateJwkWithKeyBytes(64))).toEqual(['HS256', 'HS384', 'HS512'])
    })

    test('returns no algorithms for an oct key below the 256 bit minimum', () => {
      expect(supportedSigningAlgsForKey(octPrivateJwkWithKeyBytes(16))).toEqual([])
    })
  })

  describe('allowedSigningAlgsForSigningKey', () => {
    test('returns every supported algorithm when the key has no alg restriction', () => {
      expect(allowedSigningAlgsForSigningKey(ed25519PublicJwk)).toEqual(['EdDSA', 'Ed25519'])
    })

    test('narrows to the requested alg when it is supported by the key', () => {
      expect(allowedSigningAlgsForSigningKey({ ...ed25519PublicJwk, alg: 'Ed25519' })).toEqual(['Ed25519'])
      expect(allowedSigningAlgsForSigningKey({ ...p256PublicJwk, alg: 'ES256' })).toEqual(['ES256'])
    })

    test('returns no algorithms when the requested alg is not supported by the key', () => {
      expect(allowedSigningAlgsForSigningKey({ ...p256PublicJwk, alg: 'ES384' })).toEqual([])
    })
  })

  describe('assertAllowedSigningAlgForKey', () => {
    test('passes for an algorithm that the key supports', () => {
      expect(() => assertAllowedSigningAlgForKey(p256PublicJwk, 'ES256')).not.toThrow()
    })

    test('throws for an algorithm that the key does not support', () => {
      expect(() => assertAllowedSigningAlgForKey(p256PublicJwk, 'ES384')).toThrow(KeyManagementError)
    })
  })

  describe('createKeyTypeForSigningAlgorithm', () => {
    test('maps each signature algorithm to the key type used to create it', () => {
      expect(createKeyTypeForSigningAlgorithm('ES256')).toEqual({ kty: 'EC', crv: 'P-256' })
      expect(createKeyTypeForSigningAlgorithm('ES384')).toEqual({ kty: 'EC', crv: 'P-384' })
      expect(createKeyTypeForSigningAlgorithm('ES512')).toEqual({ kty: 'EC', crv: 'P-521' })
      expect(createKeyTypeForSigningAlgorithm('ES256K')).toEqual({ kty: 'EC', crv: 'secp256k1' })
      expect(createKeyTypeForSigningAlgorithm('EdDSA')).toEqual({ kty: 'OKP', crv: 'Ed25519' })
      expect(createKeyTypeForSigningAlgorithm('Ed25519')).toEqual({ kty: 'OKP', crv: 'Ed25519' })
      expect(createKeyTypeForSigningAlgorithm('HS256')).toEqual({ kty: 'oct', algorithm: 'hmac', length: 256 })
      expect(createKeyTypeForSigningAlgorithm('HS384')).toEqual({ kty: 'oct', algorithm: 'hmac', length: 384 })
      expect(createKeyTypeForSigningAlgorithm('HS512')).toEqual({ kty: 'oct', algorithm: 'hmac', length: 512 })
      expect(createKeyTypeForSigningAlgorithm('RS256')).toEqual({ kty: 'RSA', modulusLength: 2048 })
      expect(createKeyTypeForSigningAlgorithm('PS256')).toEqual({ kty: 'RSA', modulusLength: 2048 })
      expect(createKeyTypeForSigningAlgorithm('RS384')).toEqual({ kty: 'RSA', modulusLength: 3072 })
      expect(createKeyTypeForSigningAlgorithm('PS384')).toEqual({ kty: 'RSA', modulusLength: 3072 })
      expect(createKeyTypeForSigningAlgorithm('RS512')).toEqual({ kty: 'RSA', modulusLength: 4096 })
      expect(createKeyTypeForSigningAlgorithm('PS512')).toEqual({ kty: 'RSA', modulusLength: 4096 })
    })

    test('throws for an unknown signature algorithm', () => {
      expect(() => createKeyTypeForSigningAlgorithm('ML-DSA-65' as never)).toThrow(KeyManagementError)
    })
  })

  describe('isKnownJwaSignatureAlgorithm', () => {
    test('recognizes the registered classical signature algorithms', () => {
      expect(isKnownJwaSignatureAlgorithm('ES256')).toBe(true)
      expect(isKnownJwaSignatureAlgorithm('EdDSA')).toBe(true)
      expect(isKnownJwaSignatureAlgorithm('Ed25519')).toBe(true)
      expect(isKnownJwaSignatureAlgorithm('ES256K')).toBe(true)
      expect(isKnownJwaSignatureAlgorithm('PS512')).toBe(true)
    })

    test('does not recognize an unregistered or post-quantum identifier', () => {
      expect(isKnownJwaSignatureAlgorithm('ML-DSA-44')).toBe(false)
      expect(isKnownJwaSignatureAlgorithm('ML-DSA-65')).toBe(false)
      expect(isKnownJwaSignatureAlgorithm('ML-DSA-87')).toBe(false)
      expect(isKnownJwaSignatureAlgorithm('not-an-algorithm')).toBe(false)
    })
  })
})
