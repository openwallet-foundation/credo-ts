import type { GetTrustedIssuersForVerification, VerificationSigner } from './agent/TrustedIssuersForVerification'
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

  /**
   * The allowed clock skew in seconds for validity checks of credentials and other signed objects, such as status
   * lists. Mobile devices especially can run slightly behind actual time, causing validity checks to fail at a
   * milliseconds / seconds boundary.
   *
   * This currently applies to:
   * - OAuth client attestations and DPoP proofs in the OpenID4VC issuer module
   * - SD-JWT VC, including status verification
   * - W3C VCDM 1.1 and 2.0 with JWT/SD-JWT
   * - mDOC device responses, including CWT status and identifier list checks
   *
   * It does not cover:
   * - W3C VCDM 1.1 JSON-LD
   * - W3C VCDM 2.0 Data Integrity Proofs, as the credential `validFrom` / `validUntil` and the proof `created` /
   *   `expires` values are not checked against the current time
   * - AnonCreds, as AnonCreds credentials have no validity period and non-revocation intervals are checked against
   *   the timestamps of the revocation status lists rather than the current time
   *
   * @default 30
   */
  validitySkewSeconds?: number

  /**
   * Optional callback to dynamically resolve trusted issuers for a verification context.
   *
   * This is the primary trust anchor resolution hook. It is called before the X.509-module-level
   * `getTrustedCertificatesForVerification` callback and before the global `trustedCertificates` list.
   *
   * Return `{ trustedIssuers: [] }` to hard-reject (trust nothing, skip remaining fallbacks).
   * Return `undefined` to fall through to the next resolution layer.
   *
   * Extension packages (e.g. `@credo-ts/openid4vc`) export additional verification types that can
   * be composed into the `AdditionalVerificationTypes` generic parameter to get full type coverage
   * on `verification`, e.g.:
   *
   * ```ts
   * getTrustedIssuersForVerification: async (
   *   agentContext,
   *   context: TrustedIssuersForVerificationContext<VerificationSigner, OpenId4VcVerificationTypes>
   * ) => { ... }
   * ```
   */
  // biome-ignore lint/suspicious/noExplicitAny: the additional verification types are open for extension by other packages
  getTrustedIssuersForVerification?: GetTrustedIssuersForVerification<VerificationSigner, any>
}

export type JsonValue = string | number | boolean | null | JsonObject | JsonArray
export type JsonArray = Array<JsonValue>
export interface JsonObject {
  [property: string]: JsonValue
}

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
