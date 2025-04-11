import type { KnownJwaKeyManagementAlgorithm } from '../jwa'
import type { KmsJwkPrivate, KmsJwkPublic, KmsJwkPublicCrv } from '../knownJwk'
import type { KmsJwkPrivateOct, KmsJwkPublicOct } from '../kty/oct'
import type { KmsJwkPrivateRsa, KmsJwkPublicRsa } from '../kty/rsa'

import { KeyManagementError } from '../../error/KeyManagementError'
import { getJwkHumanDescription } from '../humanDescription'

function isCrvJwk<Jwk extends KmsJwkPrivate | KmsJwkPublic>(
  jwk: Jwk
): jwk is Exclude<Jwk, KmsJwkPrivateOct | KmsJwkPrivateRsa | KmsJwkPublicOct | KmsJwkPublicRsa> {
  return jwk.kty === 'EC' || jwk.kty === 'OKP'
}

export function supportedKeyDerivationAlgsForKey(
  jwk: KmsJwkPrivate | Exclude<KmsJwkPublic, KmsJwkPublicOct>
): KnownJwaKeyManagementAlgorithm[] {
  const algs: KnownJwaKeyManagementAlgorithm[] = []

  const allowedCurves: KmsJwkPublicCrv['crv'][] = ['P-256', 'P-384', 'P-521', 'X25519', 'secp256k1']
  if (isCrvJwk(jwk) && allowedCurves.includes(jwk.crv)) {
    algs.push('ECDH-ES', 'ECDH-ES+A128KW', 'ECDH-ES+A192KW', 'ECDH-ES+A256KW')
  }

  if (jwk.kty === 'OKP' && jwk.crv === 'X25519') {
    algs.push('ECDH-HSALSA20')
  }

  return algs
}

/**
 * Get the allowed key derivation algs for a key. If takes all the known supported
 * algs and will filter these based on the optional `alg` key in the JWK.
 *
 * This does not handle the intended key `use` and `key_ops`.
 */
export function allowedKeyDerivationAlgsForKey(
  jwk: KmsJwkPrivate | Exclude<KmsJwkPublic, KmsJwkPublicOct>
): KnownJwaKeyManagementAlgorithm[] {
  const supportedAlgs = supportedKeyDerivationAlgsForKey(jwk)
  const allowedAlg = jwk.alg

  return !allowedAlg
    ? // If no `alg` specified on jwk, return all supported algs
      supportedAlgs
    : // If `alg` is specified and supported, return the allowed alg
      allowedAlg && supportedAlgs.includes(allowedAlg as KnownJwaKeyManagementAlgorithm)
      ? [allowedAlg as KnownJwaKeyManagementAlgorithm]
      : // Otherwise nothing is allowed (`alg` is specified but not supported)
        []
}

export function assertAllowedKeyDerivationAlgForKey(
  jwk: KmsJwkPrivate | Exclude<KmsJwkPublic, KmsJwkPublicOct>,
  algorithm: KnownJwaKeyManagementAlgorithm
) {
  const allowedAlgs = allowedKeyDerivationAlgsForKey(jwk)
  if (!allowedAlgs.includes(algorithm)) {
    const allowedAlgsText =
      allowedAlgs.length > 0 ? ` Allowed algs are ${allowedAlgs.map((alg) => `'${alg}'`).join(', ')}` : ''
    throw new KeyManagementError(
      `${getJwkHumanDescription(
        jwk
      )} cannot be used with algorithm '${algorithm}' for key derivation.${allowedAlgsText}`
    )
  }
}
