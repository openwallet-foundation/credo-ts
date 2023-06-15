import { KeyType } from '../../../../crypto'
import { Key } from '../../../../crypto/Key'
import { AriesFrameworkError } from '../../../../error'

import { VerificationMethod } from './VerificationMethod'

export const VERIFICATION_METHOD_TYPE_ED25519_VERIFICATION_KEY_2020 = 'Ed25519VerificationKey2020'
type Ed25519VerificationKey2020 = VerificationMethod & {
  type: typeof VERIFICATION_METHOD_TYPE_ED25519_VERIFICATION_KEY_2020
}

/**
 * Get a Ed25519VerificationKey2020 verification method.
 */
export function getEd25519VerificationKey2020({ key, id, controller }: { id: string; key: Key; controller: string }) {
  return new VerificationMethod({
    id,
    type: VERIFICATION_METHOD_TYPE_ED25519_VERIFICATION_KEY_2020,
    controller,
    publicKeyMultibase: key.fingerprint,
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
export function getKeyFromEd25519VerificationKey2020(verificationMethod: Ed25519VerificationKey2020) {
  if (!verificationMethod.publicKeyMultibase) {
    throw new AriesFrameworkError('verification method is missing publicKeyMultibase')
  }

  const key = Key.fromFingerprint(verificationMethod.publicKeyMultibase)
  if (key.keyType !== KeyType.Ed25519) {
    throw new AriesFrameworkError(`Verification method publicKeyMultibase is for unexpected key type ${key.keyType}`)
  }

  return key
}
