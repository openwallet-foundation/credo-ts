import { CredoError } from '../../../../error'
import { AkpPublicJwk, MlDsa44PublicJwk, MlDsa65PublicJwk, MlDsa87PublicJwk } from '../../../kms'
import type { VerificationMethod } from '../verificationMethod'
import {
  getMultikey,
  getPublicJwkFromMultikey,
  isMultikey,
  VERIFICATION_METHOD_TYPE_MULTIKEY,
} from '../verificationMethod'
import type { KeyDidMapping } from './keyDidMapping'

export const keyDidAkp: KeyDidMapping<AkpPublicJwk | MlDsa44PublicJwk | MlDsa65PublicJwk | MlDsa87PublicJwk> = {
  PublicJwkTypes: [AkpPublicJwk, MlDsa44PublicJwk, MlDsa65PublicJwk, MlDsa87PublicJwk],
  supportedVerificationMethodTypes: [VERIFICATION_METHOD_TYPE_MULTIKEY],
  getVerificationMethods: (did, publicJwk) => [getMultikey({ did, publicJwk })],
  getPublicJwkFromVerificationMethod: (verificationMethod: VerificationMethod) => {
    if (!isMultikey(verificationMethod)) {
      throw new CredoError(`Verification method with type '${verificationMethod.type}' not supported for key type AKP`)
    }

    return getPublicJwkFromMultikey(verificationMethod)
  },
}
