import type { AgentMessage } from './agent/AgentMessage'
import type { TransportSession } from './agent/TransportService'
import type { Logger } from './logger'
import type { ConnectionRecord } from './modules/connections'
import type { AutoAcceptCredential } from './modules/credentials/CredentialAutoAcceptType'
import type { MediatorPickupStrategy } from './modules/routing'
import type { FileSystem } from './storage/fs/FileSystem'
import type { default as Indy, Verkey, WalletConfig, WalletCredentials } from 'indy-sdk'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type $FixMe = any

export type WireMessage = $FixMe

export enum DidCommMimeType {
  V0 = 'application/ssi-agent-wire',
  V1 = 'application/didcomm-envelope-enc',
}

export interface InitConfig {
  host?: string
  port?: string | number
  endpoint?: string
  label: string
  publicDidSeed?: string
  mediatorRecordId?: string
  walletConfig?: WalletConfig
  walletCredentials?: WalletCredentials
  autoAcceptConnections?: boolean
  autoAcceptCredentials?: AutoAcceptCredential
  poolName?: string
  logger?: Logger
  indy: typeof Indy
  didCommMimeType?: DidCommMimeType
  fileSystem: FileSystem

  // Either path or transactions string can be provided
  genesisPath?: string
  genesisTransactions?: string

  autoAcceptMediationRequests?: boolean
  mediatorConnectionsInvite?: string
  defaultMediatorId?: string
  clearDefaultMediator?: boolean
  mediatorPollingInterval?: number
  mediatorPickupStrategy?: MediatorPickupStrategy
}

export interface UnpackedMessage {
  '@type': string
  [key: string]: unknown
}

export interface UnpackedMessageContext {
  message: UnpackedMessage
  sender_verkey?: Verkey
  recipient_verkey?: Verkey
}

export type PackedMessage = Record<string, unknown>

export interface OutboundMessage<T extends AgentMessage = AgentMessage> {
  connection: ConnectionRecord
  payload: T
}

export interface OutboundPackage {
  connection: ConnectionRecord
  payload: WireMessage
  responseRequested?: boolean
  endpoint?: string
  session?: TransportSession
}

export interface InboundConnection {
  verkey: Verkey
  connection: ConnectionRecord
}
