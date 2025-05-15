import type { KnownJwaContentEncryptionAlgorithm, KnownJwaKeyEncryptionAlgorithm } from '../jwa'
import type { KmsJwkPrivate, KmsJwkPublic } from '../knownJwk'
import type { KmsJwkPublicOct } from '../kty/oct/octJwk'

import { TypedArrayEncoder } from '../../../../utils'
import { KeyManagementError } from '../../error/KeyManagementError'
import { getJwkHumanDescription } from '../humanDescription'

export function supportedEncryptionAlgsForKey(jwk: KmsJwkPrivate | Exclude<KmsJwkPublic, KmsJwkPublicOct>) {
  const algs: Array<KnownJwaContentEncryptionAlgorithm | KnownJwaKeyEncryptionAlgorithm> = []

  // Only symmetric (oct) keys can be used directly for content encryption
  if (jwk.kty === 'oct') {
    const keyBits = TypedArrayEncoder.fromBase64(jwk.k).length * 8

    // For CBC-HMAC composite algorithms we need exact key sizes
    if (keyBits === 256) algs.push('A128CBC-HS256')
    if (keyBits === 384) algs.push('A192CBC-HS384')
    if (keyBits === 512) algs.push('A256CBC-HS512')

    // For GCM/CBC we just need the exact AES key size
    if (keyBits === 128) algs.push('A128GCM', 'A128CBC', 'A128KW')
    if (keyBits === 192) algs.push('A192GCM', 'A192KW')
    if (keyBits === 256) algs.push('A256GCM', 'A256CBC', 'A256KW', 'C20P', 'XC20P')
  }

  return algs
}

/**
 * Get the allowed content encryption algs for a key. If takes all the known supported
 * algs and will filter these based on the optional `alg` key in the JWK.
 *
 * This does not handle the intended key `use` and `key_ops`.
 */
export function allowedEncryptionAlgsForKey(
  jwk: KmsJwkPrivate | Exclude<KmsJwkPublic, KmsJwkPublicOct>
): Array<KnownJwaContentEncryptionAlgorithm | KnownJwaKeyEncryptionAlgorithm> {
  const supportedAlgs = supportedEncryptionAlgsForKey(jwk)
  const allowedAlg = jwk.alg

  return !allowedAlg
    ? // If no `alg` specified on jwk, return all supported algs
      supportedAlgs
    : // If `alg` is specified and supported, return the allowed alg
      allowedAlg && supportedAlgs.includes(allowedAlg as KnownJwaContentEncryptionAlgorithm)
      ? [allowedAlg as KnownJwaContentEncryptionAlgorithm | KnownJwaKeyEncryptionAlgorithm]
      : // Otherwise nothing is allowed (`alg` is specified but not supported)
        []
}

export function assertAllowedEncryptionAlgForKey(
  jwk: KmsJwkPrivate | Exclude<KmsJwkPublic, KmsJwkPublicOct>,
  algorithm: KnownJwaContentEncryptionAlgorithm | KnownJwaKeyEncryptionAlgorithm
) {
  const allowedAlgs = allowedEncryptionAlgsForKey(jwk)
  if (!allowedAlgs.includes(algorithm)) {
    const allowedAlgsText =
      allowedAlgs.length > 0 ? ` Allowed algs are ${allowedAlgs.map((alg) => `'${alg}'`).join(', ')}` : ''
    throw new KeyManagementError(
      `${getJwkHumanDescription(
        jwk
      )} cannot be used with algorithm '${algorithm}' for content encryption or decryption.${allowedAlgsText}`
    )
  }
}
