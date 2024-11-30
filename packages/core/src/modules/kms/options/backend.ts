import * as v from '../../../utils/valibot'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const vWithBackend = <Schema extends v.BaseSchema<any, any, any>>(schema: Schema) =>
  v.intersect([schema, v.object({ backend: v.optional(v.string()) })])

export type WithBackend<T> = T & {
  /**
   * The backend to use for creating the key. If not provided the
   * default backend for key operations will be used.
   */
  backend?: string
}
