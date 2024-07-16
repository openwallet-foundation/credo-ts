import { KeyType } from '../../../../crypto'
import { Key } from '../../../../crypto/Key'
import { CredoError } from '../../../../error'

import { VerificationMethod } from './VerificationMethod'

export const VERIFICATION_METHOD_TYPE_ED25519_VERIFICATION_KEY_2018 = 'Ed25519VerificationKey2018'
type Ed25519VerificationKey2018 = VerificationMethod & {
  type: typeof VERIFICATION_METHOD_TYPE_ED25519_VERIFICATION_KEY_2018
}

/**
 * Get a Ed25519VerificationKey2018 verification method.
 */
export function getEd25519VerificationKey2018({ key, id, controller }: { id: string; key: Key; controller: string }) {
  return new VerificationMethod({
    id,
    type: VERIFICATION_METHOD_TYPE_ED25519_VERIFICATION_KEY_2018,
    controller,
    publicKeyBase58: key.publicKeyBase58,
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
export function getKeyFromEd25519VerificationKey2018(verificationMethod: Ed25519VerificationKey2018) {
  if (verificationMethod.publicKeyBase58) {
    return Key.fromPublicKeyBase58(verificationMethod.publicKeyBase58, KeyType.Ed25519)
  }

  throw new CredoError('verification method is missing publicKeyBase58')
}
