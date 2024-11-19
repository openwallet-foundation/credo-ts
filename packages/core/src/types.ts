import type { Logger } from './logger'

export enum KeyDerivationMethod {
  /** default value in indy-sdk. Will be used when no value is provided */
  Argon2IMod = 'ARGON2I_MOD',
  /** less secure, but faster */
  Argon2IInt = 'ARGON2I_INT',
  /** raw wallet master key */
  Raw = 'RAW',
}

export interface WalletStorageConfig {
  type: string
  [key: string]: unknown
}

export interface WalletConfig {
  id: string
  key: string
  keyDerivationMethod?: KeyDerivationMethod
  storage?: WalletStorageConfig
}

export interface WalletConfigRekey {
  id: string
  key: string
  rekey: string
  keyDerivationMethod?: KeyDerivationMethod
  rekeyDerivationMethod?: KeyDerivationMethod
}

export interface WalletExportImportConfig {
  key: string
  path: string
}

export type EncryptedMessage = {
  /**
   * The "protected" member MUST be present and contain the value
   * BASE64URL(UTF8(JWE Protected Header)) when the JWE Protected
   * Header value is non-empty; otherwise, it MUST be absent.  These
   * Header Parameter values are integrity protected.
   */
  protected: string

  /**
   * The "iv" member MUST be present and contain the value
   * BASE64URL(JWE Initialization Vector) when the JWE Initialization
   * Vector value is non-empty; otherwise, it MUST be absent.
   */
  iv: string

  /**
   * The "ciphertext" member MUST be present and contain the value
   * BASE64URL(JWE Ciphertext).
   */
  ciphertext: string

  /**
   * The "tag" member MUST be present and contain the value
   * BASE64URL(JWE Authentication Tag) when the JWE Authentication Tag
   * value is non-empty; otherwise, it MUST be absent.
   */
  tag: string
}

export enum DidCommMimeType {
  V0 = 'application/ssi-agent-wire',
  V1 = 'application/didcomm-envelope-enc',
}

export interface InitConfig {
  /**
   * Agent public endpoints, sorted by priority (higher priority first)
   */
  endpoints?: string[]
  label: string
  walletConfig?: WalletConfig
  logger?: Logger
  didCommMimeType?: DidCommMimeType
  useDidKeyInProtocols?: boolean
  useDidSovPrefixWhereAllowed?: boolean
  connectionImageUrl?: string
  autoUpdateStorageOnStartup?: boolean
  backupBeforeStorageUpdate?: boolean
  processDidCommMessagesConcurrently?: boolean

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

export type ProtocolVersion = `${number}.${number}`
export interface PlaintextMessage {
  '@type': string
  '@id': string
  '~thread'?: {
    thid?: string
    pthid?: string
  }
  [key: string]: unknown
}

export interface OutboundPackage {
  payload: EncryptedMessage
  responseRequested?: boolean
  endpoint?: string
  connectionId?: string
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
 * Get the awaited (resolved promise) type of Promise type.
 */
export type Awaited<T> = T extends Promise<infer U> ? U : never

/**
 * Type util that returns `true` or `false` based on whether the input type `T` is of type `any`
 */
export type IsAny<T> = unknown extends T ? ([keyof T] extends [never] ? false : true) : false
