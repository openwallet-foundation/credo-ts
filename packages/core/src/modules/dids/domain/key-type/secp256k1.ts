import type { KeyDidMapping } from './keyDidMapping'
import type { VerificationMethod } from '../verificationMethod'

import { KeyType } from '../../../../crypto/KeyType'
import { CredoError } from '../../../../error'
import {
  VERIFICATION_METHOD_TYPE_ECDSA_SECP256K1_VERIFICATION_KEY_2019,
  getEcdsaSecp256k1VerificationKey2019,
  getKeyFromEcdsaSecp256k1VerificationKey2019,
  getKeyFromJsonWebKey2020,
  isEcdsaSecp256k1VerificationKey2019,
  isJsonWebKey2020,
} from '../verificationMethod'

export const keyDidSecp256k1: KeyDidMapping = {
  supportedVerificationMethodTypes: [VERIFICATION_METHOD_TYPE_ECDSA_SECP256K1_VERIFICATION_KEY_2019],
  getVerificationMethods: (did, key) => [
    getEcdsaSecp256k1VerificationKey2019({ id: `${did}#${key.fingerprint}`, key, controller: did }),
  ],
  getKeyFromVerificationMethod: (verificationMethod: VerificationMethod) => {
    if (isEcdsaSecp256k1VerificationKey2019(verificationMethod)) {
      return getKeyFromEcdsaSecp256k1VerificationKey2019(verificationMethod)
    }

    if (isJsonWebKey2020(verificationMethod)) {
      return getKeyFromJsonWebKey2020(verificationMethod)
    }

    throw new CredoError(
      `Verification method with type '${verificationMethod.type}' not supported for key type '${KeyType.K256}'`
    )
  },
}
