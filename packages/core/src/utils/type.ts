import type { JsonObject } from '../types'

export type SingleOrArray<T> = T | T[]

export type Optional<T, K extends keyof T> = Pick<Partial<T>, K> & Omit<T, K>

export const isJsonObject = (value: unknown): value is JsonObject => {
  return value !== undefined && typeof value === 'object' && value !== null && !Array.isArray(value)
}

// eslint-disable-next-line @typescript-eslint/ban-types
export type StringWithAutoComplete<AutoComplete extends string> = AutoComplete | (string & {})
// eslint-disable-next-line @typescript-eslint/ban-types
export type NumberWithAutoComplete<AutoComplete extends number> = AutoComplete | (number & {})

export type CanBePromise<T> = T | Promise<T>
