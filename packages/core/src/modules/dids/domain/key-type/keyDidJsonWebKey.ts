import type { KeyDidMapping } from './keyDidMapping'
import type { VerificationMethod } from '../verificationMethod'

import { Key } from '../../../../crypto'
import { AriesFrameworkError } from '../../../../error'
import { getJsonWebKey2020VerificationMethod } from '../verificationMethod'
import { VERIFICATION_METHOD_TYPE_JSON_WEB_KEY_2020, isJsonWebKey2020 } from '../verificationMethod/JsonWebKey2020'

export const keyDidJsonWebKey: KeyDidMapping = {
  supportedVerificationMethodTypes: [VERIFICATION_METHOD_TYPE_JSON_WEB_KEY_2020],
  getVerificationMethods: (did, key) => [getJsonWebKey2020VerificationMethod(did, key)],

  getKeyFromVerificationMethod: (verificationMethod: VerificationMethod) => {
    if (!isJsonWebKey2020(verificationMethod) || !verificationMethod.publicKeyJwk) {
      throw new AriesFrameworkError('Invalid verification method passed')
    }

    return Key.fromJwk(verificationMethod.publicKeyJwk)
  },
}
