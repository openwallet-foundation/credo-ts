import type { AgentMessage } from './agent/AgentMessage'
import type { Logger } from './logger'
import type { ConnectionRecord, DidCommService } from './modules/connections'
import type { AutoAcceptCredential } from './modules/credentials/CredentialAutoAcceptType'
import type { IndyPoolConfig } from './modules/ledger/IndyPool'
import type { AutoAcceptProof } from './modules/proofs'
import type { MediatorPickupStrategy } from './modules/routing'
import type { CredReqMetadata } from 'indy-sdk'

export interface WalletConfig {
  id: string
  key: string
}

export type WireMessage = {
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
  connectLedgersOnStart?: boolean

  autoAcceptMediationRequests?: boolean
  mediatorConnectionsInvite?: string
  defaultMediatorId?: string
  clearDefaultMediator?: boolean
  mediatorPollingInterval?: number
  mediatorPickupStrategy?: MediatorPickupStrategy

  useLegacyDidSovPrefix?: boolean
  connectionImageUrl?: string
}

export interface UnpackedMessage {
  '@type': string
  [key: string]: unknown
}

export interface UnpackedMessageContext {
  message: UnpackedMessage
  senderVerkey?: string
  recipientVerkey?: string
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
  payload: WireMessage
  responseRequested?: boolean
  endpoint?: string
  connectionId?: string
}

// Metadata type for `_internal/indyCredential`
export interface IndyCredentialMetadata {
  schemaId?: string
  credentialDefinitionId?: string
}

// Metadata type for  `_internal/indyRequest`
export type IndyCredentialRequestMetadata = CredReqMetadata
