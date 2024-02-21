import type { KeyDidMapping } from './keyDidMapping'
import type { VerificationMethod } from '../verificationMethod'

import { KeyType } from '../../../../crypto/KeyType'
import { CredoError } from '../../../../error'
import {
  getKeyFromBls12381G1Key2020,
  isBls12381G1Key2020,
  getBls12381G1Key2020,
  VERIFICATION_METHOD_TYPE_BLS12381G1_KEY_2020,
} from '../verificationMethod'

export const keyDidBls12381g1: KeyDidMapping = {
  supportedVerificationMethodTypes: [VERIFICATION_METHOD_TYPE_BLS12381G1_KEY_2020],

  getVerificationMethods: (did, key) => [
    getBls12381G1Key2020({ id: `${did}#${key.fingerprint}`, key, controller: did }),
  ],
  getKeyFromVerificationMethod: (verificationMethod: VerificationMethod) => {
    if (isBls12381G1Key2020(verificationMethod)) {
      return getKeyFromBls12381G1Key2020(verificationMethod)
    }

    throw new CredoError(
      `Verification method with type '${verificationMethod.type}' not supported for key type '${KeyType.Bls12381g1}'`
    )
  },
}
