import { type Jwk, type KnownJwaSignatureAlgorithm, PublicJwk } from '../modules/kms'

export type Kid = string

export interface JwsProtectedHeaderOptions {
  alg: KnownJwaSignatureAlgorithm
  kid?: Kid
  jwk?: PublicJwk | Jwk
  x5c?: string[]
  [key: string]: unknown
}

export interface JwsGeneralFormat {
  /**
   * unprotected header
   */
  header: Record<string, unknown>

  /**
   * Base64url encoded signature
   */
  signature: string

  /**
   * Base64url encoded protected header
   */
  protected: string

  /**
   * Base64url encoded payload
   */
  payload: string
}

export interface JwsFlattenedFormat {
  /**
   * Base64url encoded payload
   */
  payload: string

  /**
   * List of JWS signatures over the payload
   *
   * The items in this array do not contain the payload.
   */
  signatures: JwsDetachedFormat[]
}

/**
 * JWS Compact Serialization
 *
 * @see https://tools.ietf.org/html/rfc7515#section-7.1
 */
export type JwsCompactFormat = string

export type Jws = JwsGeneralFormat | JwsFlattenedFormat | JwsCompactFormat

// Detached JWS (does not contain payload)
export type JwsDetachedFormat = Omit<JwsGeneralFormat, 'payload'>
export interface JwsFlattenedDetachedFormat {
  signatures: JwsDetachedFormat[]
}

export const JWS_COMPACT_FORMAT_MATCHER = /^[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*$/
