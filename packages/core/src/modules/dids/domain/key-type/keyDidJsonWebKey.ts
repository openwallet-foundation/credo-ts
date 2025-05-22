import type { KeyDidMapping } from './keyDidMapping'

import { CredoError } from '../../../../error'
import { P256PublicJwk, P384PublicJwk, P521PublicJwk } from '../../../kms'
import { getJsonWebKey2020 } from '../verificationMethod'
import { VERIFICATION_METHOD_TYPE_JSON_WEB_KEY_2020 } from '../verificationMethod/JsonWebKey2020'

export const keyDidJsonWebKey: KeyDidMapping<P256PublicJwk | P384PublicJwk | P521PublicJwk> = {
  PublicJwkTypes: [P256PublicJwk, P384PublicJwk, P521PublicJwk],
  supportedVerificationMethodTypes: [VERIFICATION_METHOD_TYPE_JSON_WEB_KEY_2020],
  getVerificationMethods: (did, publicJwk) => [getJsonWebKey2020({ did, publicJwk })],

  getPublicJwkFromVerificationMethod: () => {
    // This is handled on a higher level
    throw new CredoError('Not supported for key did json web key')
  },
}
