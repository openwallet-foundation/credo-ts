import { CredoError } from '../../../../error'
import { TypedArrayEncoder } from '../../../../utils'
import { Ed25519PublicJwk, PublicJwk } from '../../../kms'

import { VerificationMethod } from './VerificationMethod'

export const VERIFICATION_METHOD_TYPE_ED25519_VERIFICATION_KEY_2018 = 'Ed25519VerificationKey2018'
type Ed25519VerificationKey2018 = VerificationMethod & {
  type: typeof VERIFICATION_METHOD_TYPE_ED25519_VERIFICATION_KEY_2018
}

/**
 * Get a Ed25519VerificationKey2018 verification method.
 */
export function getEd25519VerificationKey2018({
  publicJwk,
  id,
  controller,
}: {
  id: string
  publicJwk: PublicJwk<Ed25519PublicJwk>
  controller: string
}) {
  return new VerificationMethod({
    id,
    type: VERIFICATION_METHOD_TYPE_ED25519_VERIFICATION_KEY_2018,
    controller,
    publicKeyBase58: TypedArrayEncoder.toBase58(publicJwk.publicKey.publicKey),
  })
}

/**
 * Check whether a verification method is a Ed25519VerificationKey2018 verification method.
 */
export function isEd25519VerificationKey2018(
  verificationMethod: VerificationMethod
): verificationMethod is Ed25519VerificationKey2018 {
  return verificationMethod.type === VERIFICATION_METHOD_TYPE_ED25519_VERIFICATION_KEY_2018
}

/**
 * Get a key from a Ed25519VerificationKey2018 verification method.
 */

/**
 * Get a public jwk from a Ed25519VerificationKey2018 verification method.
 */
export function getPublicJwkFromEd25519VerificationKey2018(verificationMethod: Ed25519VerificationKey2018) {
  if (!verificationMethod.publicKeyBase58) {
    throw new CredoError('verification method is missing publicKeyBase58')
  }

  return PublicJwk.fromPublicKey({
    kty: 'OKP',
    crv: 'Ed25519',
    publicKey: TypedArrayEncoder.fromBase58(verificationMethod.publicKeyBase58),
  })
}
