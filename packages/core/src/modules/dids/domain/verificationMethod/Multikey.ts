import type { VerificationMethod } from './VerificationMethod'

import { Key } from '../../../../crypto/Key'
import { CredoError } from '../../../../error'

export const VERIFICATION_METHOD_TYPE_MULTIKEY = 'Multikey'

type GetMultikeyOptions = {
  did: string
  key: Key
  verificationMethodId?: string
}

/**
 * Get a Multikey verification method.
 */
export function getMultikey({ did, key, verificationMethodId }: GetMultikeyOptions) {
  if (!verificationMethodId) {
    verificationMethodId = `${did}#${key.fingerprint}`
  }

  return {
    id: verificationMethodId,
    type: VERIFICATION_METHOD_TYPE_MULTIKEY,
    controller: did,
    publicKeyMultibase: key.fingerprint,
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
 * Get a key from a Multikey verification method.
 */
export function getKeyFromMultikey(verificationMethod: VerificationMethod & { type: 'Multikey' }) {
  if (!verificationMethod.publicKeyMultibase) {
    throw new CredoError(
      `Missing publicKeyMultibase on verification method with type ${VERIFICATION_METHOD_TYPE_MULTIKEY}`
    )
  }

  return Key.fromFingerprint(verificationMethod.publicKeyMultibase)
}
