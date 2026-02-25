import { CredoError } from '../../../../error'
import { Ed25519PublicJwk } from '../../../kms'
import type { VerificationMethod } from '../verificationMethod'
import {
  getEd25519VerificationKey2018,
  getPublicJwkFromEd25519VerificationKey2018,
  getPublicJwkFromEd25519VerificationKey2020,
  isEd25519VerificationKey2018,
  isEd25519VerificationKey2020,
  VERIFICATION_METHOD_TYPE_ED25519_VERIFICATION_KEY_2018,
  VERIFICATION_METHOD_TYPE_ED25519_VERIFICATION_KEY_2020,
  VERIFICATION_METHOD_TYPE_JSON_WEB_KEY_2020,
  VERIFICATION_METHOD_TYPE_MULTIKEY,
} from '../verificationMethod'
import type { KeyDidMapping } from './keyDidMapping'

export { convertPublicKeyToX25519 } from '@stablelib/ed25519'

export const keyDidEd25519: KeyDidMapping<Ed25519PublicJwk> = {
  PublicJwkTypes: [Ed25519PublicJwk],
  supportedVerificationMethodTypes: [
    VERIFICATION_METHOD_TYPE_ED25519_VERIFICATION_KEY_2018,
    VERIFICATION_METHOD_TYPE_ED25519_VERIFICATION_KEY_2020,
    VERIFICATION_METHOD_TYPE_JSON_WEB_KEY_2020,
    VERIFICATION_METHOD_TYPE_MULTIKEY,
  ],
  getVerificationMethods: (did, publicJwk) => [
    getEd25519VerificationKey2018({ id: `${did}#${publicJwk.fingerprint}`, publicJwk, controller: did }),
  ],

  getPublicJwkFromVerificationMethod: (verificationMethod: VerificationMethod) => {
    if (isEd25519VerificationKey2018(verificationMethod)) {
      return getPublicJwkFromEd25519VerificationKey2018(verificationMethod)
    }

    if (isEd25519VerificationKey2020(verificationMethod)) {
      return getPublicJwkFromEd25519VerificationKey2020(verificationMethod)
    }

    throw new CredoError(
      `Verification method with type '${verificationMethod.type}' not supported for key type Ed25519`
    )
  },
}
