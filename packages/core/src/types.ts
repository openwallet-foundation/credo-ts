import type { TransportPriorityOptions } from './agent/MessageSender'
import type { DIDCommMessage, EncryptedMessage, DIDCommV2Message } from './agent/didcomm/index'
import type { Logger } from './logger'
import type { ConnectionRecord } from './modules/connections'
import type { AutoAcceptCredential } from './modules/credentials/CredentialAutoAcceptType'
import type { DidType } from './modules/dids'
import type { DidProps } from './modules/dids/domain/Did'
import type { DidCommService } from './modules/dids/domain/service/DidCommService'
import type { IndyPoolConfig } from './modules/ledger/IndyPool'
import type { AutoAcceptProof } from './modules/proofs'
import type { MediatorPickupStrategy, MediatorDeliveryStrategy } from './modules/routing'
import type { Transports } from './modules/routing/types'
import type { AutoAcceptValueTransfer } from './modules/value-transfer/ValueTransferAutoAcceptType'
import type { WitnessInfo } from '@sicpa-dlab/value-transfer-protocol-ts'

export const enum KeyDerivationMethod {
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

export enum WitnessType {
  One = '1',
  Two = '2',
  Three = '2',
}

export interface ValueTransferWitnessConfig {
  wid: string
  knownWitnesses: WitnessInfo[]
  tockTime?: number
  cleanupTime?: number
  redeliverTime?: number
  historyThreshold?: number
  redeliveryThreshold?: number
  issuerDids?: string[]
}

export interface ValueTransferConfig {
  party?: ValueTransferPartyConfig
  witness?: ValueTransferWitnessConfig
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
  supportOffline?: boolean
  catchErrors?: boolean

  indyLedgers?: IndyPoolConfig[]
  connectToIndyLedgersOnStartup?: boolean

  transports?: Transports[]

  autoAcceptMediationRequests?: boolean
  mediatorConnectionsInvite?: string
  defaultMediatorId?: string
  clearDefaultMediator?: boolean
  mediatorPollingInterval?: number
  mediatorPickupStrategy?: MediatorPickupStrategy
  mediatorDeliveryStrategy?: MediatorDeliveryStrategy
  mediatorPushToken?: string
  mediatorWebHookEndpoint?: string

  staticDids?: DidProps[]

  useLegacyDidSovPrefix?: boolean
  connectionImageUrl?: string
  valueTransferConfig?: ValueTransferConfig
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
}

export interface OutboundPlainMessage<T extends DIDCommMessage = DIDCommMessage> {
  payload: T
}

export interface OutboundSignedMessage<T extends DIDCommMessage = DIDCommMessage> {
  payload: T
  from: string
}

export interface OutboundDIDCommV2Message<T extends DIDCommV2Message = DIDCommV2Message> {
  payload: T
}

export interface OutboundServiceMessage<T extends DIDCommMessage = DIDCommMessage> {
  payload: T
  service: DidCommService
  senderKey: string
}

export interface OutboundPackage {
  payload: EncryptedMessage | PlaintextMessage
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

export type SendMessageOptions = {
  transportPriority?: TransportPriorityOptions
}
