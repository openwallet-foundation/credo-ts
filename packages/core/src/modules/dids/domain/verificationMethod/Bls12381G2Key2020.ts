import { KeyType } from '../../../../crypto'
import { Key } from '../../../../crypto/Key'
import { CredoError } from '../../../../error'

import { VerificationMethod } from './VerificationMethod'

export const VERIFICATION_METHOD_TYPE_BLS12381G2_KEY_2020 = 'Bls12381G2Key2020'
type Bls12381G2Key2020 = VerificationMethod & {
  type: typeof VERIFICATION_METHOD_TYPE_BLS12381G2_KEY_2020
}

/**
 * Get a Bls12381G2Key2020 verification method.
 */
export function getBls12381G2Key2020({ key, id, controller }: { id: string; key: Key; controller: string }) {
  return new VerificationMethod({
    id,
    type: VERIFICATION_METHOD_TYPE_BLS12381G2_KEY_2020,
    controller,
    publicKeyBase58: key.publicKeyBase58,
  })
}

/**
 * Check whether a verification method is a Bls12381G2Key2020 verification method.
 */
export function isBls12381G2Key2020(verificationMethod: VerificationMethod): verificationMethod is Bls12381G2Key2020 {
  return verificationMethod.type === VERIFICATION_METHOD_TYPE_BLS12381G2_KEY_2020
}

/**
 * Get a key from a Bls12381G2Key2020 verification method.
 */
export function getKeyFromBls12381G2Key2020(verificationMethod: Bls12381G2Key2020) {
  if (!verificationMethod.publicKeyBase58) {
    throw new CredoError('verification method is missing publicKeyBase58')
  }

  return Key.fromPublicKeyBase58(verificationMethod.publicKeyBase58, KeyType.Bls12381g2)
}
