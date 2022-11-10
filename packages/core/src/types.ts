import type { DIDCommV1Message, DIDCommV2Message, EncryptedMessage, SignedMessage } from './agent/didcomm'
import type { PlaintextMessage } from './agent/didcomm/types'
import type { Key } from './crypto'
import type { Logger } from './logger'
import type { ConnectionRecord } from './modules/connections'
import type { AutoAcceptCredential } from './modules/credentials/models/CredentialAutoAcceptType'
import type { ResolvedDidCommService } from './modules/didcomm'
import type { IndyPoolConfig } from './modules/ledger/IndyPool'
import type { OutOfBandRecord } from './modules/oob/repository'
import type { AutoAcceptProof } from './modules/proofs'
import type { MediatorPickupStrategy } from './modules/routing'
import type { BaseRecord } from './storage/BaseRecord'

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

export interface OutboundDIDCommV1Message<T extends DIDCommV1Message = DIDCommV1Message> {
  payload: T
  connection: ConnectionRecord
  sessionId?: string
  outOfBand?: OutOfBandRecord
  associatedRecord?: BaseRecord
}

export interface OutboundDIDCommV1ServiceMessage<T extends DIDCommV1Message = DIDCommV1Message> {
  payload: T
  service: ResolvedDidCommService
  senderKey: Key
}

export interface OutboundDIDCommV2Message<T extends DIDCommV2Message = DIDCommV2Message> {
  payload: T
}

export type OutboundPackagePayload = EncryptedMessage | SignedMessage | PlaintextMessage

export interface OutboundPackage {
  payload: OutboundPackagePayload
  responseRequested?: boolean
  endpoint?: string
  connectionId?: string
}

export type JsonValue = string | number | boolean | null | JsonObject | JsonArray
export type JsonArray = Array<JsonValue>
export interface JsonObject {
  [property: string]: JsonValue
}
