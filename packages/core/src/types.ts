import type { Logger } from './logger'
import type { AutoAcceptCredential } from './modules/credentials/models/CredentialAutoAcceptType'
import type { IndyPoolConfig } from './modules/ledger/IndyPool'
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

export interface WalletConfig {
  id: string
  key: string
  keyDerivationMethod?: KeyDerivationMethod
  storage?: {
    type: string
    [key: string]: unknown
  }
  masterSecretId?: string
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

export enum DidCommMimeType {
  V0 = 'application/ssi-agent-wire',
  V1 = 'application/didcomm-envelope-enc',
}

export interface InitConfig {
  endpoints?: string[]
  label: string
  publicDidSeed?: string
  mediatorRecordId?: string
  walletConfig?: WalletConfig
  autoAcceptConnections?: boolean
  autoAcceptProofs?: AutoAcceptProof
  autoAcceptCredentials?: AutoAcceptCredential
  logger?: Logger
  didCommMimeType?: DidCommMimeType

  indyLedgers?: IndyPoolConfig[]
  connectToIndyLedgersOnStartup?: boolean

  autoAcceptMediationRequests?: boolean
  mediatorConnectionsInvite?: string
  defaultMediatorId?: string
  clearDefaultMediator?: boolean
  mediatorPollingInterval?: number
  mediatorPickupStrategy?: MediatorPickupStrategy
  maximumMessagePickup?: number
  baseMediatorReconnectionIntervalMs?: number
  maximumMediatorReconnectionIntervalMs?: number
  useDidKeyInProtocols?: boolean

  useLegacyDidSovPrefix?: boolean
  connectionImageUrl?: string

  autoUpdateStorageOnStartup?: boolean
}

export type ProtocolVersion = `${number}.${number}`

export type JsonValue = string | number | boolean | null | JsonObject | JsonArray
export type JsonArray = Array<JsonValue>
export interface JsonObject {
  [property: string]: JsonValue
}
