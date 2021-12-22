import type { AgentMessage } from './agent/AgentMessage'
import type { Logger } from './logger'
import type { ConnectionRecord, DidCommService } from './modules/connections'
import type { AutoAcceptCredential } from './modules/credentials/CredentialAutoAcceptType'
import type { IndyPoolConfig } from './modules/ledger/IndyPool'
import type { AutoAcceptProof } from './modules/proofs'
import type { MediatorPickupStrategy } from './modules/routing'

export interface WalletConfig {
  id: string
  key: string
}

export type EncryptedMessage = {
  protected: unknown
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
  publicDidSeed?: string
  mediatorRecordId?: string
  walletConfig?: WalletConfig
  autoAcceptConnections?: boolean
  autoAcceptProofs?: AutoAcceptProof
  autoAcceptCredentials?: AutoAcceptCredential
  logger?: Logger
  didCommMimeType?: DidCommMimeType

  indyLedgers?: IndyPoolConfig[]

  autoAcceptMediationRequests?: boolean
  mediatorConnectionsInvite?: string
  defaultMediatorId?: string
  clearDefaultMediator?: boolean
  mediatorPollingInterval?: number
  mediatorPickupStrategy?: MediatorPickupStrategy

  useLegacyDidSovPrefix?: boolean
  connectionImageUrl?: string
}

export interface PlaintextMessage {
  '@type': string
  '@id': string
  [key: string]: unknown
}

export interface DecryptedMessageContext {
  plaintextMessage: PlaintextMessage
  senderKey?: string
  recipientKey?: string
}

export interface OutboundMessage<T extends AgentMessage = AgentMessage> {
  payload: T
  connection: ConnectionRecord
}

export interface OutboundServiceMessage<T extends AgentMessage = AgentMessage> {
  payload: T
  service: DidCommService
  senderKey: string
}

export interface OutboundPackage {
  payload: EncryptedMessage
  responseRequested?: boolean
  endpoint?: string
  connectionId?: string
}
