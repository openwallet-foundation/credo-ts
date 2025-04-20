import * as z from '../../../utils/zod'
import { zKnownJwaSignatureAlgorithm } from '../jwk/jwa'
import { zKmsKeyId } from './common'

export const zKmsSignOptions = z.object({
  /**
   * The key to use for signing
   */
  keyId: zKmsKeyId,

  /**
   * The JWA signature algorithm to use for signing
   */
  algorithm: zKnownJwaSignatureAlgorithm.describe('The JWA signature algorithm to use for signing'),

  /**
   * The data to sign
   */
  data: z.instanceof(Uint8Array).describe('The data to sign'),
})

export type KmsSignOptions = z.output<typeof zKmsSignOptions>
export interface KmsSignReturn {
  signature: Uint8Array
}
