import type { VerificationMethod } from '../verificationMethod'
import type { KeyDidMapping } from './keyDidMapping'

import { KeyType } from '../../../../crypto/KeyType'
import { CredoError } from '../../../../error'
import {
  VERIFICATION_METHOD_TYPE_JSON_WEB_KEY_2020,
  VERIFICATION_METHOD_TYPE_MULTIKEY,
  VERIFICATION_METHOD_TYPE_X25519_KEY_AGREEMENT_KEY_2019,
  getKeyFromJsonWebKey2020,
  getKeyFromMultikey,
  getKeyFromX25519KeyAgreementKey2019,
  getX25519KeyAgreementKey2019,
  isJsonWebKey2020,
  isMultikey,
  isX25519KeyAgreementKey2019,
} from '../verificationMethod'

export const keyDidX25519: KeyDidMapping = {
  supportedVerificationMethodTypes: [
    VERIFICATION_METHOD_TYPE_X25519_KEY_AGREEMENT_KEY_2019,
    VERIFICATION_METHOD_TYPE_JSON_WEB_KEY_2020,
    VERIFICATION_METHOD_TYPE_MULTIKEY,
  ],
  getVerificationMethods: (did, key) => [
    getX25519KeyAgreementKey2019({ id: `${did}#${key.fingerprint}`, key, controller: did }),
  ],
  getKeyFromVerificationMethod: (verificationMethod: VerificationMethod) => {
    if (isJsonWebKey2020(verificationMethod)) {
      return getKeyFromJsonWebKey2020(verificationMethod)
    }

    if (isX25519KeyAgreementKey2019(verificationMethod)) {
      return getKeyFromX25519KeyAgreementKey2019(verificationMethod)
    }

    if (isMultikey(verificationMethod)) {
      return getKeyFromMultikey(verificationMethod)
    }

    throw new CredoError(
      `Verification method with type '${verificationMethod.type}' not supported for key type '${KeyType.X25519}'`
    )
  },
}
