import type { KnownJwaSignatureAlgorithm } from '../jwa'
import type { KmsJwkPrivate, KmsJwkPublic } from '../knownJwk'
import type { KmsJwkPublicOct } from '../kty/oct'

import { TypedArrayEncoder } from '../../../../utils'
import { KeyManagementError } from '../../error/KeyManagementError'
import { getJwkHumanDescription } from '../humanDescription'

/**
 * Get the allowed algs for a signing key. If takes all the known supported
 * algs and will filter these based on the optional `alg` key in the JWK.
 *
 * This does not handle the intended key `use` and `key_ops`.
 */
export function allowedSigningAlgsForSigningKey(
  jwk: KmsJwkPrivate | Exclude<KmsJwkPublic, KmsJwkPublicOct>
): KnownJwaSignatureAlgorithm[] {
  const supportedAlgs = supportedSigningAlgsForKey(jwk)
  const allowedAlg = jwk.alg

  return !allowedAlg
    ? // If no `alg` specified on jwk, return all supported algs
      supportedAlgs
    : // If `alg` is specified and supported, return the allowed alg
      allowedAlg && supportedAlgs.includes(allowedAlg as KnownJwaSignatureAlgorithm)
      ? [allowedAlg as KnownJwaSignatureAlgorithm]
      : // Otherwise nothing is allowed (`alg` is specified but not supported)
        []
}

export function assertAllowedSigningAlgForKey(
  jwk: KmsJwkPrivate | Exclude<KmsJwkPublic, KmsJwkPublicOct>,
  algorithm: KnownJwaSignatureAlgorithm
) {
  const allowedAlgs = allowedSigningAlgsForSigningKey(jwk)
  if (!allowedAlgs.includes(algorithm)) {
    const allowedAlgsText =
      allowedAlgs.length > 0 ? ` Allowed algs are ${allowedAlgs.map((alg) => `'${alg}'`).join(', ')}` : ''
    throw new KeyManagementError(
      `${getJwkHumanDescription(
        jwk
      )} cannot be used with algorithm '${algorithm}' for signature creation or verification.${allowedAlgsText}`
    )
  }
}

export function supportedSigningAlgsForKey(
  jwk: KmsJwkPrivate | Exclude<KmsJwkPublic, KmsJwkPublicOct>
): KnownJwaSignatureAlgorithm[] {
  if (jwk.kty === 'EC' || jwk.kty === 'OKP') {
    switch (jwk.crv) {
      case 'secp256k1':
        return ['ES256K']
      case 'P-256':
        return ['ES256']
      case 'P-384':
        return ['ES384']
      case 'P-521':
        return ['ES512']
      case 'Ed25519':
        return ['EdDSA']

      // X25519
      default:
        return []
    }
  }

  if (jwk.kty === 'RSA') {
    const keyBits = TypedArrayEncoder.fromBase64(jwk.n).length * 8

    // RSA needs minimum bit lengths for each algorithm
    const minBits2048: KnownJwaSignatureAlgorithm[] = ['PS256', 'RS256']
    const minBits3072: KnownJwaSignatureAlgorithm[] = [...minBits2048, 'RS384', 'PS384']
    const minBits4096: KnownJwaSignatureAlgorithm[] = [...minBits3072, 'RS512', 'PS512']

    return keyBits >= 4096 ? minBits4096 : keyBits >= 3072 ? minBits3072 : keyBits >= 2048 ? minBits2048 : []
  }

  // On other layers we need to filter for alg types, as you don't want any `oct` key with enough length to used for hmac purposes
  if (jwk.kty === 'oct') {
    const keyBits = TypedArrayEncoder.fromBase64(jwk.k).length * 8

    // hmac needs minimum bit lengths for each algorithm
    const minBits256: KnownJwaSignatureAlgorithm[] = ['HS256']
    const minBits384: KnownJwaSignatureAlgorithm[] = [...minBits256, 'HS384']
    const minBits512: KnownJwaSignatureAlgorithm[] = [...minBits384, 'HS512']
    return keyBits >= 512 ? minBits512 : keyBits >= 384 ? minBits384 : keyBits >= 256 ? minBits256 : []
  }

  return []
}
