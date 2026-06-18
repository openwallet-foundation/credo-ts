import { TypedArrayEncoder } from '../../utils'
import { KeyManagementError } from './error/KeyManagementError'
import type { PublicJwk } from './jwk/PublicJwk'

/**
 * Returns the legacy key id based on the public key encoded as base58
 *
 * This is what was has been used by askar
 */
export function legacyKeyIdFromPublicJwk(publicJwk: PublicJwk) {
  // Compressed public keys were used for legacy key ids
  const compressedPublicKey = publicJwk.compressedPublicKey
  if (compressedPublicKey) {
    return TypedArrayEncoder.toBase58(compressedPublicKey.publicKey)
  }

  const publicKey = publicJwk.publicKey
  if (publicKey.kty === 'RSA') {
    throw new KeyManagementError(
      'Unable to derive legacy key id from RSA key. Support for RSA keys was only added after explicit key ids were added.'
    )
  }

  return TypedArrayEncoder.toBase58(publicKey.publicKey)
}
