import { z } from 'zod'
import type { zBaseSchema } from '../../../utils/zod'

export const zWithBackend = <Schema extends zBaseSchema>(schema: Schema) =>
  schema.and(z.object({ backend: z.optional(z.string()) }))

export type WithBackend<T> = T & {
  /**
   * The backend to use for creating the key. If not provided the
   * default backend for key operations will be used.
   */
  backend?: string
}
