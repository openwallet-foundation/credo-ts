/**
 * Allows all properties of `T` to be `null`, in addition to their current type.
 *
 * @example
 * ```
 * type Options = Nullable<{ name?: string }>
 *
 * type Options = { name?: string | null }
 * ```
 */
export type Nullable<T> = { [Key in keyof T]: T[Key] | null }
