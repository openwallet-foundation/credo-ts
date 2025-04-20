import type { VerificationMethod } from '../verificationMethod'
import type { KeyDidMapping } from './keyDidMapping'

import { KeyType } from '../../../../crypto/KeyType'
import { CredoError } from '../../../../error'
import {
  VERIFICATION_METHOD_TYPE_ECDSA_SECP256K1_VERIFICATION_KEY_2019,
  VERIFICATION_METHOD_TYPE_JSON_WEB_KEY_2020,
  VERIFICATION_METHOD_TYPE_MULTIKEY,
  getJsonWebKey2020,
  getKeyFromEcdsaSecp256k1VerificationKey2019,
  getPublicJwkFromEcdsaSecp256k1VerificationKey2019,
  isEcdsaSecp256k1VerificationKey2019,
} from '../verificationMethod'

export const keyDidSecp256k1: KeyDidMapping = {
  supportedVerificationMethodTypes: [
    VERIFICATION_METHOD_TYPE_ECDSA_SECP256K1_VERIFICATION_KEY_2019,
    VERIFICATION_METHOD_TYPE_JSON_WEB_KEY_2020,
    VERIFICATION_METHOD_TYPE_MULTIKEY,
  ],
  getVerificationMethods: (did, key) => [getJsonWebKey2020({ did, key })],
  getKeyFromVerificationMethod: (verificationMethod: VerificationMethod) => {
    if (isEcdsaSecp256k1VerificationKey2019(verificationMethod)) {
      return getKeyFromEcdsaSecp256k1VerificationKey2019(verificationMethod)
    }

    throw new CredoError(
      `Verification method with type '${verificationMethod.type}' not supported for key type '${KeyType.K256}'`
    )
  },
  getPublicJwkFromVerificationMethod: (verificationMethod: VerificationMethod) => {
    if (isEcdsaSecp256k1VerificationKey2019(verificationMethod)) {
      return getPublicJwkFromEcdsaSecp256k1VerificationKey2019(verificationMethod)
    }

    throw new CredoError(
      `Verification method with type '${verificationMethod.type}' not supported for key type '${KeyType.K256}'`
    )
  },
}
