import type { Logger } from './logger'
import type { DidCommMimeType } from './modules/didcomm' // TODO: Remove dependency on DIDComm

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

export interface InitConfig {
  /**
   * Agent public endpoints, sorted by priority (higher priority first)
   */
  label: string
  walletConfig?: WalletConfig
  logger?: Logger
  autoUpdateStorageOnStartup?: boolean
  backupBeforeStorageUpdate?: boolean
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
