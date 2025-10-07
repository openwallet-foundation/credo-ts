import { KeyManagementError } from '../error/KeyManagementError'
import { getJwkHumanDescription } from './humanDescription'
import type { KmsJwkPrivateAsymmetric, KmsJwkPublicAsymmetric } from './knownJwk'

/**
 * Checks if two JWK public keys have matching key types
 * Supports EC, OKP, and RSA key types
 */
export function assymetricJwkKeyTypeMatches(
  first: KmsJwkPublicAsymmetric | KmsJwkPrivateAsymmetric,
  second: KmsJwkPublicAsymmetric | KmsJwkPrivateAsymmetric
): boolean {
  if (first.kty !== second.kty) return false

  if (first.kty === 'EC' && second.kty === 'EC') {
    return first.crv === second.crv
  }

  if (first.kty === 'OKP' && second.kty === 'OKP') {
    return first.crv === second.crv
  }

  if (first.kty === 'RSA' && second.kty === 'RSA') {
    // RSA doesn't have curve parameter, so key type match is sufficient
    return true
  }

  // Unknown key type
  return false
}

/**
 * Checks if two JWK public keys have matching key types
 * Supports EC, OKP, and RSA key types
 */
export function assertAsymmetricJwkKeyTypeMatches(
  first: KmsJwkPublicAsymmetric | KmsJwkPrivateAsymmetric,
  second: KmsJwkPublicAsymmetric | KmsJwkPrivateAsymmetric
): asserts first is typeof second {
  if (!assymetricJwkKeyTypeMatches(first, second)) {
    throw new KeyManagementError(
      `Expected jwk types to match, but found ${getJwkHumanDescription(first)} and ${getJwkHumanDescription(second)}`
    )
  }
}

/**
 * Checks if two JWK public keys have matching key material
 * Supports EC, OKP, and RSA key types
 */
export function assymetricPublicJwkMatches(first: KmsJwkPublicAsymmetric, second: KmsJwkPublicAsymmetric): boolean {
  // First check that types match
  if (!assymetricJwkKeyTypeMatches(first, second)) {
    return false
  }

  // For EC keys, compare x and y coordinates
  if (first.kty === 'EC' && second.kty === 'EC') {
    return first.x === second.x && first.y === second.y
  }

  // For OKP keys, compare x coordinate (Ed25519, X25519, etc.)
  if (first.kty === 'OKP' && second.kty === 'OKP') {
    return first.x === second.x
  }

  // For RSA keys, compare modulus (n) and exponent (e)
  if (first.kty === 'RSA' && second.kty === 'RSA') {
    return first.n === second.n && first.e === second.e
  }

  // Unknown key type
  return false
}
