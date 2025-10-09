import { z } from 'zod'

export const zKmsRandomBytesOptions = z.object({
  /**
   * The number of random bytes to genreate
   */
  length: z.number().positive(),
})

export type KmsRandomBytesOptions = z.output<typeof zKmsRandomBytesOptions>

/**
 * The generated random bytes
 */
export type KmsRandomBytesReturn = Uint8Array
