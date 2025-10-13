import { CredoError } from '../../../../error'
import { Secp256k1PublicJwk } from '../../../kms'
import type { VerificationMethod } from '../verificationMethod'
import {
  getJsonWebKey2020,
  getPublicJwkFromEcdsaSecp256k1VerificationKey2019,
  isEcdsaSecp256k1VerificationKey2019,
  VERIFICATION_METHOD_TYPE_ECDSA_SECP256K1_VERIFICATION_KEY_2019,
  VERIFICATION_METHOD_TYPE_JSON_WEB_KEY_2020,
  VERIFICATION_METHOD_TYPE_MULTIKEY,
} from '../verificationMethod'
import type { KeyDidMapping } from './keyDidMapping'

export const keyDidSecp256k1: KeyDidMapping<Secp256k1PublicJwk> = {
  PublicJwkTypes: [Secp256k1PublicJwk],
  supportedVerificationMethodTypes: [
    VERIFICATION_METHOD_TYPE_ECDSA_SECP256K1_VERIFICATION_KEY_2019,
    VERIFICATION_METHOD_TYPE_JSON_WEB_KEY_2020,
    VERIFICATION_METHOD_TYPE_MULTIKEY,
  ],
  getVerificationMethods: (did, publicJwk) => [getJsonWebKey2020({ did, publicJwk })],
  getPublicJwkFromVerificationMethod: (verificationMethod: VerificationMethod) => {
    if (isEcdsaSecp256k1VerificationKey2019(verificationMethod)) {
      return getPublicJwkFromEcdsaSecp256k1VerificationKey2019(verificationMethod)
    }

    throw new CredoError(
      `Verification method with type '${verificationMethod.type}' not supported for key type Secp256K1`
    )
  },
}
