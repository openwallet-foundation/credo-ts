import * as z from '../../../utils/zod'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const zWithBackend = <Schema extends z.BaseSchema>(schema: Schema) =>
  schema.and(z.object({ backend: z.optional(z.string()) }))

export type WithBackend<T> = T & {
  /**
   * The backend to use for creating the key. If not provided the
   * default backend for key operations will be used.
   */
  backend?: string
}
