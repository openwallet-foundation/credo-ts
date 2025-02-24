import type { KnownJwaSignatureAlgorithm } from '../jwk/jwa'

import * as z from '../../../utils/zod'
import { vKnownJwaSignatureAlgorithm } from '../jwk/jwa'

export const vKmsSignOptions = z.object({
  /**
   * The key to use for signing
   */
  keyId: z.string(),

  /**
   * The JWA signature algorithm to use for signing
   */
  algorithm: vKnownJwaSignatureAlgorithm.describe('The JWA signature algorithm to use for signing'),

  /**
   * The data to sign
   */
  data: z.instanceof(Uint8Array).describe('The data to sign'),
})

export type KmsSignOptions = z.output<typeof vKmsSignOptions>
export interface KmsSignReturn {
  signature: Uint8Array
}
