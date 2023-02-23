import type { JsonObject } from '../types'

export type SingleOrArray<T> = T | T[]

export type Optional<T, K extends keyof T> = Pick<Partial<T>, K> & Omit<T, K>

export const isJsonObject = (value: unknown): value is JsonObject => {
  return value !== undefined && typeof value === 'object' && value !== null && !Array.isArray(value)
}
