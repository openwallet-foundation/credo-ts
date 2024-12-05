// reflect-metadata used for class-transformer + class-validator
import 'reflect-metadata'

export { Agent } from './agent/Agent'
export { BaseAgent } from './agent/BaseAgent'
export * from './agent'
export type { ModulesMap, DefaultAgentModules, EmptyModuleMap } from './agent/AgentModules'
export { EventEmitter } from './agent/EventEmitter'
export { AgentConfig } from './agent/AgentConfig'

export type { AgentDependencies } from './agent/AgentDependencies'

export type {
  InitConfig,
  WalletConfig,
  JsonArray,
  JsonObject,
  JsonValue,
  WalletConfigRekey,
  WalletExportImportConfig,
  WalletStorageConfig,
} from './types'
export { KeyDerivationMethod } from './types'
export type { FileSystem, DownloadToFileOptions } from './storage/FileSystem'
export * from './storage/BaseRecord'
export { Repository } from './storage/Repository'
export * from './storage/RepositoryEvents'
export { StorageService, Query, QueryOptions, SimpleQuery, BaseRecordConstructor } from './storage/StorageService'
export * from './storage/migration'
export { getDirFromFilePath, joinUriParts } from './utils/path'
export { InjectionSymbols } from './constants'
export * from './wallet'
export { VersionString } from './utils/version'

export * from './plugins'
export * from './modules/x509'
export * from './modules/didcomm'
export * from './modules/dids'
export * from './modules/vc'
export * from './modules/cache'
export * from './modules/dif-presentation-exchange'
export * from './modules/sd-jwt-vc'
export * from './modules/mdoc'
export {
  JsonEncoder,
  JsonTransformer,
  isJsonObject,
  TypedArrayEncoder,
  Buffer,
  deepEquality,
  isDid,
  asArray,
  equalsIgnoreOrder,
  DateTransformer,
} from './utils'
export * from './logger'
export * from './error'
export * from './wallet/error'
export type { Constructor, Constructable } from './utils/mixins'
export * from './agent/Events'
export * from './crypto'

// TODO: clean up util exports
export type { Optional } from './utils'
export { getDomainFromUrl } from './utils/domain'
import { parseInvitationUrl } from './modules/didcomm'
import { uuid, isValidUuid } from './utils/uuid'

const utils = {
  uuid,
  isValidUuid,
  parseInvitationUrl,
}

export { utils }
