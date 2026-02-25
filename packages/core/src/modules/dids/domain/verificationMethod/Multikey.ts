import { CredoError } from '../../../../error'
import { PublicJwk } from '../../../kms'
import type { VerificationMethod } from './VerificationMethod'

export const VERIFICATION_METHOD_TYPE_MULTIKEY = 'Multikey'

type GetMultikeyOptions = {
  did: string
  publicJwk: PublicJwk
  verificationMethodId?: string
}

/**
 * Get a Multikey verification method.
 */
export function getMultikey({ did, publicJwk, verificationMethodId }: GetMultikeyOptions) {
  if (!verificationMethodId) {
    verificationMethodId = `${did}#${publicJwk.fingerprint}`
  }

  return {
    id: verificationMethodId,
    type: VERIFICATION_METHOD_TYPE_MULTIKEY,
    controller: did,
    publicKeyMultibase: publicJwk.fingerprint,
  }
}

/**
 * Check whether a verification method is a Multikey verification method.
 */
export function isMultikey(
  verificationMethod: VerificationMethod
): verificationMethod is VerificationMethod & { type: 'Multikey' } {
  return verificationMethod.type === VERIFICATION_METHOD_TYPE_MULTIKEY
}

/**
 * Get a public jwk from a Multikey verification method.
 */
export function getPublicJwkFromMultikey(verificationMethod: VerificationMethod & { type: 'Multikey' }) {
  if (!verificationMethod.publicKeyMultibase) {
    throw new CredoError(
      `Missing publicKeyMultibase on verification method with type ${VERIFICATION_METHOD_TYPE_MULTIKEY}`
    )
  }

  return PublicJwk.fromFingerprint(verificationMethod.publicKeyMultibase)
}
