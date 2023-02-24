import type { Logger } from './logger'
import type { AutoAcceptCredential } from './modules/credentials/models/CredentialAutoAcceptType'
import type { AutoAcceptProof } from './modules/proofs'
import type { MediatorPickupStrategy } from './modules/routing'

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
  protected: string
  iv: unknown
  ciphertext: unknown
  tag: unknown
}

export enum DidCommMimeType {
  V0 = 'application/ssi-agent-wire',
  V1 = 'application/didcomm-envelope-enc',
}

export interface InitConfig {
  endpoints?: string[]
  label: string
  walletConfig?: WalletConfig
  logger?: Logger
  didCommMimeType?: DidCommMimeType
  useDidKeyInProtocols?: boolean
  useDidSovPrefixWhereAllowed?: boolean
  connectionImageUrl?: string
  autoUpdateStorageOnStartup?: boolean

  /**
   * @deprecated configure `autoAcceptConnections` on the `ConnectionsModule` class
   * @note This setting will be ignored if the `ConnectionsModule` is manually configured as
   * a module
   */
  autoAcceptConnections?: boolean

  /**
   * @deprecated configure `autoAcceptProofs` on the `ProofModule` class
   * @note This setting will be ignored if the `ProofsModule` is manually configured as
   * a module
   */
  autoAcceptProofs?: AutoAcceptProof

  /**
   * @deprecated configure `autoAcceptCredentials` on the `CredentialsModule` class
   * @note This setting will be ignored if the `CredentialsModule` is manually configured as
   * a module
   */
  autoAcceptCredentials?: AutoAcceptCredential

  /**
   * @deprecated configure `autoAcceptMediationRequests` on the `RecipientModule` class
   * @note This setting will be ignored if the `RecipientModule` is manually configured as
   * a module
   */
  autoAcceptMediationRequests?: boolean

  /**
   * @deprecated configure `mediatorConnectionsInvite` on the `RecipientModule` class
   * @note This setting will be ignored if the `RecipientModule` is manually configured as
   * a module
   */
  mediatorConnectionsInvite?: string

  /**
   * @deprecated you can use `RecipientApi.setDefaultMediator` to set the default mediator.
   */
  defaultMediatorId?: string

  /**
   * @deprecated you can set the `default` tag to `false` (or remove it completely) to clear the default mediator.
   */
  clearDefaultMediator?: boolean

  /**
   * @deprecated configure `mediatorPollingInterval` on the `RecipientModule` class
   * @note This setting will be ignored if the `RecipientModule` is manually configured as
   * a module
   */
  mediatorPollingInterval?: number

  /**
   * @deprecated configure `mediatorPickupStrategy` on the `RecipientModule` class
   * @note This setting will be ignored if the `RecipientModule` is manually configured as
   * a module
   */
  mediatorPickupStrategy?: MediatorPickupStrategy

  /**
   * @deprecated configure `maximumMessagePickup` on the `RecipientModule` class
   * @note This setting will be ignored if the `RecipientModule` is manually configured as
   * a module
   */
  maximumMessagePickup?: number

  /**
   * @deprecated configure `baseMediatorReconnectionIntervalMs` on the `RecipientModule` class
   * @note This setting will be ignored if the `RecipientModule` is manually configured as
   * a module
   */
  baseMediatorReconnectionIntervalMs?: number

  /**
   * @deprecated configure `maximumMediatorReconnectionIntervalMs` on the `RecipientModule` class
   * @note This setting will be ignored if the `RecipientModule` is manually configured as
   * a module
   */
  maximumMediatorReconnectionIntervalMs?: number
}

export type ProtocolVersion = `${number}.${number}`
export interface PlaintextMessage {
  '@type': string
  '@id': string
  '~thread'?: {
    thid?: string
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
