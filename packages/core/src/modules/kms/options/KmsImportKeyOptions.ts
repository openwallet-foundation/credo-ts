import type { KmsCreateKeyReturn } from './KmsCreateKeyOptions'

import * as v from '../../../utils/valibot'
import { vKmsJwkPrivate, type KmsJwkPrivate } from '../jwk/knownJwk'

export interface KmsImportKeyOptions {
  /**
   * The private jwk to import. If the jwk needs to use a specific keyId, make sure to set
   * the `kid` property on the JWK. If not provided a key id will be generated.
   */
  privateJwk: KmsJwkPrivate
}

export const vKmsImportKeyOptions = v.object({
  privateJwk: vKmsJwkPrivate,
})

export type KmsImportKeyReturn = KmsCreateKeyReturn
