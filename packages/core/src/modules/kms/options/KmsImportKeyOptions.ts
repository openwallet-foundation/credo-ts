import * as z from '../../../utils/zod'
import { vKmsJwkPrivate, type KmsJwkPrivate } from '../jwk/knownJwk'

import { type KmsCreateKeyReturn } from './KmsCreateKeyOptions'

export const vKmsImportKeyOptions = z.object({
  /**
   * The private jwk to import. If the key needs to use a specific keyId, make sure to set
   * the `kid` property on the JWK. If no kid is provided a key id will be generated.
   */
  privateJwk: vKmsJwkPrivate,
})

export type KmsImportKeyOptions = z.output<typeof vKmsImportKeyOptions>
export type KmsImportKeyReturn = KmsCreateKeyReturn
