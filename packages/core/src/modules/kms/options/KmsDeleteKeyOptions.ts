import * as z from '../../../utils/zod'

export const zKmsDeleteKeyOptions = z.object({
  /**
   * The `kid` for the key.
   */
  keyId: z.string(),
})

export type KmsDeleteKeyOptions = z.output<typeof zKmsDeleteKeyOptions>
