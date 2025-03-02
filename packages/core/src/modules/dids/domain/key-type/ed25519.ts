import type { VerificationMethod } from '../verificationMethod'
import type { KeyDidMapping } from './keyDidMapping'

import { KeyType } from '../../../../crypto/KeyType'
import { CredoError } from '../../../../error'
import {
  VERIFICATION_METHOD_TYPE_ED25519_VERIFICATION_KEY_2018,
  VERIFICATION_METHOD_TYPE_ED25519_VERIFICATION_KEY_2020,
  VERIFICATION_METHOD_TYPE_JSON_WEB_KEY_2020,
  VERIFICATION_METHOD_TYPE_MULTIKEY,
  getEd25519VerificationKey2018,
  getKeyFromEd25519VerificationKey2018,
  getKeyFromEd25519VerificationKey2020,
  getKeyFromJsonWebKey2020,
  getKeyFromMultikey,
  isEd25519VerificationKey2018,
  isEd25519VerificationKey2020,
  isJsonWebKey2020,
  isMultikey,
} from '../verificationMethod'

export { convertPublicKeyToX25519 } from '@stablelib/ed25519'

export const keyDidEd25519: KeyDidMapping = {
  supportedVerificationMethodTypes: [
    VERIFICATION_METHOD_TYPE_ED25519_VERIFICATION_KEY_2018,
    VERIFICATION_METHOD_TYPE_ED25519_VERIFICATION_KEY_2020,
    VERIFICATION_METHOD_TYPE_JSON_WEB_KEY_2020,
    VERIFICATION_METHOD_TYPE_MULTIKEY,
  ],
  getVerificationMethods: (did, key) => [
    getEd25519VerificationKey2018({ id: `${did}#${key.fingerprint}`, key, controller: did }),
  ],
  getKeyFromVerificationMethod: (verificationMethod: VerificationMethod) => {
    if (isEd25519VerificationKey2018(verificationMethod)) {
      return getKeyFromEd25519VerificationKey2018(verificationMethod)
    }

    if (isEd25519VerificationKey2020(verificationMethod)) {
      return getKeyFromEd25519VerificationKey2020(verificationMethod)
    }

    if (isJsonWebKey2020(verificationMethod)) {
      return getKeyFromJsonWebKey2020(verificationMethod)
    }

    if (isMultikey(verificationMethod)) {
      return getKeyFromMultikey(verificationMethod)
    }

    throw new CredoError(
      `Verification method with type '${verificationMethod.type}' not supported for key type '${KeyType.Ed25519}'`
    )
  },
}
