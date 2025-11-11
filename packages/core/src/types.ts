import type { Logger } from './logger'
import { Ed25519PublicJwk, PublicJwk } from './modules/kms'

export interface InitConfig {
  logger?: Logger
  autoUpdateStorageOnStartup?: boolean

  /**
   * Allow insecure http urls in places where this is usually required.
   * Unsecure http urls may still be allowed in places where this is not checked (e.g. didcomm)
   *
   * For some flows this config option is set globally, which means that different agent configurations
   * will fight for the configuration. It is meant as a local development option.
   *
   * Use with caution
   *
   * @default false
   */
  allowInsecureHttpUrls?: boolean
}

export type JsonValue = string | number | boolean | null | JsonObject | JsonArray
export type JsonArray = Array<JsonValue>
export interface JsonObject {
  [property: string]: JsonValue
}

/**
 * Typescript 5.7/5.9 made the Uint8Array generic. This causes a lot of type errors
 * and is also not backwards compatible with older TypeScript versions.
 *
 * This type util infers the return type, so that in older versions the non generic
 * Uint8Array is used, and in newer version the generic Uint8Array is used.
 *
 * See https://github.com/microsoft/typescript/issues/62240
 */
export type Uint8ArrayBuffer = ReturnType<typeof Uint8Array.from>

export type AnyUint8Array = Uint8Array

/**
 * Flatten an array of arrays
 * @example
 * ```
 * type Flattened = FlatArray<[[1], [2]]>
 *
 * // is the same as
 * type Flattened = 1 | 2
 * ```
 */
export type FlatArray<Arr> = Arr extends ReadonlyArray<infer InnerArr> ? FlatArray<InnerArr> : Arr

/**
 * Create an exclusive or, setting the other params to 'never' which helps with
 * type narrowing
 *
 * @example
 * ```
 * type Options = XOR<{ name: string }, { dateOfBirth: Date }>
 *
 * type Options =
 *  | { name: string; dateOfBirth?: never }
 *  | { name?: never; dateOfBirth: Date }
 * ```
 */
export type XOR<T, U> =
  | (T & { [P in keyof Omit<U, keyof T>]?: never })
  | (U & { [P in keyof Omit<T, keyof U>]?: never })

/**
 * Get the awaited (resolved promise) type of Promise type.
 */
export type Awaited<T> = T extends Promise<infer U> ? U : never

/**
 * Type util that returns `true` or `false` based on whether the input type `T` is of type `any`
 */
export type IsAny<T> = unknown extends T ? ([keyof T] extends [never] ? false : true) : false

export interface ResolvedDidCommService {
  id: string
  serviceEndpoint: string
  recipientKeys: PublicJwk<Ed25519PublicJwk>[]
  routingKeys: PublicJwk<Ed25519PublicJwk>[]
}

export const isJsonObject = (value: unknown): value is JsonObject => {
  return value !== undefined && typeof value === 'object' && value !== null && !Array.isArray(value)
}

export type SingleOrArray<T> = T | T[]
export type Optional<T, K extends keyof T> = Pick<Partial<T>, K> & Omit<T, K>
export type CanBePromise<T> = T | Promise<T>

export type NonEmptyArray<T> = [T, ...T[]]
export function mapNonEmptyArray<U, M extends (item: U, index: number) => unknown>(
  array: NonEmptyArray<U>,
  mapFunction: M
): NonEmptyArray<ReturnType<M>> {
  return array.map(mapFunction) as NonEmptyArray<ReturnType<M>>
}
export function isNonEmptyArray<U>(array: U[]): array is NonEmptyArray<U> {
  return array.length > 0
}
