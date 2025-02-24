import * as z from '../../../utils/zod'

export const vKmsGetPublicKeyOptions = z.object({
  /**
   * The key id of the key to get the public bytes for.
   */
  keyId: z.string(),
})

export type KmsGetPublicKeyOptions = z.output<typeof vKmsGetPublicKeyOptions>
