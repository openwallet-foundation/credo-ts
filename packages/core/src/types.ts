import type { DIDCommMessage } from './agent/didcomm/DIDCommMessage'
import type { EncryptedMessageRecipient, SignedMessage } from './agent/didcomm/types'
import type { Logger } from './logger'
import type { ConnectionRecord } from './modules/connections'
import type { AutoAcceptCredential } from './modules/credentials'
import type { ResolvedDidCommService } from './modules/didcomm'
import type { DidType } from './modules/dids'
import type { DidProps } from './modules/dids/domain/Did'
import type { Key } from './modules/dids/domain/Key'
import type { IndyPoolConfig } from './modules/ledger/IndyPool'
import type { OutOfBandRecord } from './modules/oob/repository'
import type { AutoAcceptProof } from './modules/proofs'
import type { MediatorDeliveryStrategy, MediatorPickupStrategy } from './modules/routing'
import type { Transports } from './modules/routing/types'
import type { AutoAcceptValueTransfer } from './modules/value-transfer/ValueTransferAutoAcceptType'
import type {
  GossipConfig,
  GossipPlugins,
  GossipStorageConfig,
  WitnessDetails,
} from '@sicpa-dlab/witness-gossip-types-ts'

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

export interface ValueTransferPartyConfig {
  witnessDid?: string
  autoAcceptPaymentOffer?: AutoAcceptValueTransfer
  autoAcceptOfferedPaymentRequest?: AutoAcceptValueTransfer
  autoAcceptPaymentRequest?: AutoAcceptValueTransfer
}

export interface ValueTransferWitnessConfig {
  wid: string
  knownWitnesses: WitnessDetails[]
  gossipConfig?: GossipConfig
  gossipPlugins?: Partial<GossipPlugins>
  issuerDids?: string[]
}

export interface ValueTransferConfig {
  party?: ValueTransferPartyConfig
  witness?: ValueTransferWitnessConfig
}

export type EncryptedMessage = {
  protected: string
  iv: string
  ciphertext: string
  tag: string
  recipients: EncryptedMessageRecipient[]
}

export enum DidCommMimeType {
  V0 = 'application/ssi-agent-wire',
  V1 = 'application/didcomm-envelope-enc',
}

export interface InitConfig {
  endpoints?: string[]
  label: string
  publicDidSeed?: string
  publicDidType?: DidType
  mediatorRecordId?: string
  walletConfig?: WalletConfig
  autoAcceptConnections?: boolean
  autoAcceptProofs?: AutoAcceptProof
  autoAcceptCredentials?: AutoAcceptCredential
  logger?: Logger
  didCommMimeType?: DidCommMimeType
  catchErrors?: boolean
  lockTransactions?: boolean

  indyLedgers?: IndyPoolConfig[]
  connectToIndyLedgersOnStartup?: boolean

  transports?: Transports[]

  autoAcceptMediationRequests?: boolean
  mediatorConnectionsInvite?: string
  defaultMediatorId?: string
  clearDefaultMediator?: boolean
  mediatorPollingInterval?: number
  mediatorWebSocketConfig?: Partial<{
    startReconnectIntervalMs: number
    maxReconnectIntervalMs: number
    intervalStepMs: number
  }>
  mediatorPickupStrategy?: MediatorPickupStrategy
  mediatorDeliveryStrategy?: MediatorDeliveryStrategy
  mediatorPushToken?: string
  mediatorWebHookEndpoint?: string

  staticDids?: DidProps[]
  maximumMessagePickup?: number
  baseMediatorReconnectionIntervalMs?: number
  maximumMediatorReconnectionIntervalMs?: number
  useDidKeyInProtocols?: boolean

  useLegacyDidSovPrefix?: boolean
  connectionImageUrl?: string
  valueTransferConfig?: ValueTransferConfig

  autoUpdateStorageOnStartup?: boolean

  internetChecker?: InternetChecker

  gossipStorageConfig?: GossipStorageConfig
}

export type PlaintextMessage = PlaintextMessageV1 | PlaintextMessageV2

export interface PlaintextMessageV1 {
  '@type': string
  '@id': string
  [key: string]: unknown
}

export interface PlaintextMessageV2 {
  type: string
  id: string
  [key: string]: unknown
}

export interface DecryptedMessageContext {
  plaintextMessage: PlaintextMessage
  senderKey?: string
  recipientKey?: string
}

export interface OutboundMessage<T extends DIDCommMessage = DIDCommMessage> {
  payload: T
  connection: ConnectionRecord
  sessionId?: string
  outOfBand?: OutOfBandRecord
}

export interface OutboundPlainMessage<T extends DIDCommMessage = DIDCommMessage> {
  payload: T
}

export interface OutboundSignedMessage<T extends DIDCommMessage = DIDCommMessage> {
  payload: T
  from: string
}

export interface OutboundServiceMessage<T extends DIDCommMessage = DIDCommMessage> {
  payload: T
  service: ResolvedDidCommService
  senderKey: Key
}

export type OutboundPackagePayload = EncryptedMessage | SignedMessage | PlaintextMessage

export interface OutboundPackage {
  payload: OutboundPackagePayload
  recipientDid?: string
  responseRequested?: boolean
  endpoint?: string
  connectionId?: string
}

export type JsonValue = string | number | boolean | null | JsonObject | JsonArray
export type JsonArray = Array<JsonValue>
export interface JsonObject {
  [property: string]: JsonValue
}

export interface TransportPriorityOptions {
  schemes: string[]
  restrictive?: boolean
}

export type SendMessageOptions = {
  transportPriority?: TransportPriorityOptions
}

export interface InternetChecker {
  hasInternetAccess(): Promise<boolean>
}
