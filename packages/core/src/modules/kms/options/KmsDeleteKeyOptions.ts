import { z } from 'zod'
import { zKmsKeyId } from './common'

export const zKmsDeleteKeyOptions = z.object({
  /**
   * The `kid` for the key.
   */
  keyId: zKmsKeyId,
})

export type KmsDeleteKeyOptions = z.output<typeof zKmsDeleteKeyOptions>
