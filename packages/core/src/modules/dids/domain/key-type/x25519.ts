import { CredoError } from '../../../../error'
import { X25519PublicJwk } from '../../../kms'
import type { VerificationMethod } from '../verificationMethod'
import {
  VERIFICATION_METHOD_TYPE_JSON_WEB_KEY_2020,
  VERIFICATION_METHOD_TYPE_MULTIKEY,
  VERIFICATION_METHOD_TYPE_X25519_KEY_AGREEMENT_KEY_2019,
  getPublicJwkFrommX25519KeyAgreementKey2019,
  getX25519KeyAgreementKey2019,
  isX25519KeyAgreementKey2019,
} from '../verificationMethod'
import type { KeyDidMapping } from './keyDidMapping'

export const keyDidX25519: KeyDidMapping<X25519PublicJwk> = {
  PublicJwkTypes: [X25519PublicJwk],
  supportedVerificationMethodTypes: [
    VERIFICATION_METHOD_TYPE_X25519_KEY_AGREEMENT_KEY_2019,
    VERIFICATION_METHOD_TYPE_JSON_WEB_KEY_2020,
    VERIFICATION_METHOD_TYPE_MULTIKEY,
  ],
  getVerificationMethods: (did, publicJwk) => [
    getX25519KeyAgreementKey2019({ id: `${did}#${publicJwk.fingerprint}`, publicJwk, controller: did }),
  ],

  getPublicJwkFromVerificationMethod: (verificationMethod: VerificationMethod) => {
    if (isX25519KeyAgreementKey2019(verificationMethod)) {
      return getPublicJwkFrommX25519KeyAgreementKey2019(verificationMethod)
    }

    throw new CredoError(`Verification method with type '${verificationMethod.type}' not supported for key type X25519`)
  },
}
