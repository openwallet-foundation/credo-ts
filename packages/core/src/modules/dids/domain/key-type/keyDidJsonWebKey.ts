import type { VerificationMethod } from '../verificationMethod'
import type { KeyDidMapping } from './keyDidMapping'

import { getJwkFromJson } from '../../../../crypto/jose/jwk'
import { CredoError } from '../../../../error'
import { getJsonWebKey2020 } from '../verificationMethod'
import { VERIFICATION_METHOD_TYPE_JSON_WEB_KEY_2020, isJsonWebKey2020 } from '../verificationMethod/JsonWebKey2020'

export const keyDidJsonWebKey: KeyDidMapping = {
  supportedVerificationMethodTypes: [VERIFICATION_METHOD_TYPE_JSON_WEB_KEY_2020],
  getVerificationMethods: (did, key) => [getJsonWebKey2020({ did, key })],

  getKeyFromVerificationMethod: (verificationMethod: VerificationMethod) => {
    if (!isJsonWebKey2020(verificationMethod) || !verificationMethod.publicKeyJwk) {
      throw new CredoError('Invalid verification method passed')
    }

    return getJwkFromJson(verificationMethod.publicKeyJwk).key
  },
}
