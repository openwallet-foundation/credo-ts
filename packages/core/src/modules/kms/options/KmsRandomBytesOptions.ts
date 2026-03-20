import { z } from 'zod'
import type { Uint8ArrayBuffer } from '../../../types'

export const zKmsRandomBytesOptions = z.object({
  /**
   * The number of random bytes to generate
   */
  length: z.number().positive(),
})

export type KmsRandomBytesOptions = z.output<typeof zKmsRandomBytesOptions>

/**
 * The generated random bytes
 */
export type KmsRandomBytesReturn = Uint8ArrayBuffer
