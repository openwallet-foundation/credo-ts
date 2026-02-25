import { CredoError } from '../../../../error'
import { Ed25519PublicJwk, getJwkHumanDescription, PublicJwk } from '../../../kms'

import { VerificationMethod } from './VerificationMethod'

export const VERIFICATION_METHOD_TYPE_ED25519_VERIFICATION_KEY_2020 = 'Ed25519VerificationKey2020'
type Ed25519VerificationKey2020 = VerificationMethod & {
  type: typeof VERIFICATION_METHOD_TYPE_ED25519_VERIFICATION_KEY_2020
}

/**
 * Get a Ed25519VerificationKey2020 verification method.
 */
export function getEd25519VerificationKey2020({
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
    type: VERIFICATION_METHOD_TYPE_ED25519_VERIFICATION_KEY_2020,
    controller,
    publicKeyMultibase: publicJwk.fingerprint,
  })
}

/**
 * Check whether a verification method is a Ed25519VerificationKey2020 verification method.
 */
export function isEd25519VerificationKey2020(
  verificationMethod: VerificationMethod
): verificationMethod is Ed25519VerificationKey2020 {
  return verificationMethod.type === VERIFICATION_METHOD_TYPE_ED25519_VERIFICATION_KEY_2020
}

/**
 * Get a key from a Ed25519VerificationKey2020 verification method.
 */
export function getPublicJwkFromEd25519VerificationKey2020(verificationMethod: Ed25519VerificationKey2020) {
  if (!verificationMethod.publicKeyMultibase) {
    throw new CredoError('verification method is missing publicKeyMultibase')
  }

  const publicJwk = PublicJwk.fromFingerprint(verificationMethod.publicKeyMultibase)
  const publicKey = publicJwk.publicKey

  if (publicKey.kty !== 'OKP' || publicKey.crv !== 'Ed25519') {
    throw new CredoError(
      `Verification method ${verificationMethod.type} is for unexpected ${getJwkHumanDescription(publicJwk.toJson())}.`
    )
  }

  return publicJwk
}
