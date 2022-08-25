// reflect-metadata used for class-transformer + class-validator
import 'reflect-metadata'

export { MessageReceiver } from './agent/MessageReceiver'
export { Agent } from './agent/Agent'
export { BaseAgent } from './agent/BaseAgent'
export * from './agent'
export { EventEmitter } from './agent/EventEmitter'
export { Handler, HandlerInboundMessage } from './agent/Handler'
export { InboundMessageContext } from './agent/models/InboundMessageContext'
export { AgentConfig } from './agent/AgentConfig'
export { AgentMessage } from './agent/AgentMessage'
export { Dispatcher } from './agent/Dispatcher'
export { MessageSender } from './agent/MessageSender'
export type { AgentDependencies } from './agent/AgentDependencies'
export type { InitConfig, OutboundPackage, EncryptedMessage, WalletConfig } from './types'
export { DidCommMimeType, KeyDerivationMethod } from './types'
export type { FileSystem } from './storage/FileSystem'
export * from './storage/BaseRecord'
export { InMemoryMessageRepository } from './storage/InMemoryMessageRepository'
export { Repository } from './storage/Repository'
export * from './storage/RepositoryEvents'
export { StorageService } from './storage/StorageService'
export { getDirFromFilePath } from './utils/path'
export { InjectionSymbols } from './constants'
export type { Wallet } from './wallet/Wallet'
export type { TransportSession } from './agent/TransportService'
export { TransportService } from './agent/TransportService'
export { Attachment } from './decorators/attachment/Attachment'

import { parseInvitationUrl } from './utils/parseInvitation'
import { uuid } from './utils/uuid'

export * from './plugins'
export * from './transport'
export * from './modules/basic-messages'
export * from './modules/common'
export * from './modules/credentials'
export * from './modules/discover-features'
export * from './modules/proofs'
export * from './modules/connections'
export * from './modules/ledger'
export * from './modules/routing'
export * from './modules/question-answer'
export * from './modules/oob'
export * from './wallet/WalletApi'
export * from './modules/dids'
export { JsonEncoder, JsonTransformer, isJsonObject, isValidJweStructure } from './utils'
export * from './logger'
export * from './error'
export * from './wallet/error'
export { Key, KeyType } from './crypto'
export { parseMessageType, IsValidMessageType } from './utils/messageType'

export * from './agent/Events'

const utils = {
  uuid,
  parseInvitationUrl,
}

export { utils }
