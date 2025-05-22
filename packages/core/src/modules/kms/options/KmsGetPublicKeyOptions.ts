import * as z from '../../../utils/zod'
import { zKmsKeyId } from './common'

export const zKmsGetPublicKeyOptions = z.object({
  /**
   * The key id of the key to get the public bytes for.
   */
  keyId: zKmsKeyId,
})

export type KmsGetPublicKeyOptions = z.output<typeof zKmsGetPublicKeyOptions>
