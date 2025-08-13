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
  JsonArray,
  JsonObject,
  JsonValue,
  ResolvedDidCommService,
  XOR,
  CanBePromise,
  SingleOrArray,
  Optional,
  NonEmptyArray,
} from './types'
export { mapNonEmptyArray, isNonEmptyArray } from './types'
export { isJsonObject } from './types'
export type { FileSystem, DownloadToFileOptions } from './storage/FileSystem'
export * from './storage/BaseRecord'
export { Repository } from './storage/Repository'
export * from './storage/RepositoryEvents'
export { StorageService, Query, QueryOptions, SimpleQuery, BaseRecordConstructor } from './storage/StorageService'
export * from './storage/migration'
export { Metadata } from './storage/Metadata'
export { UpdateConfig, V0_1ToV0_2UpdateConfig } from './storage/migration/updates'

export { getDirFromFilePath, joinUriParts } from './utils/path'
export { InjectionSymbols } from './constants'
export { VersionString } from './utils/version'

export * from './plugins'
export * from './modules/x509'
export * from './modules/dids'
export * from './modules/vc'
export * from './modules/cache'
export * from './modules/dif-presentation-exchange'
export * from './modules/sd-jwt-vc'
export * from './modules/mdoc'
export * as Kms from './modules/kms'
export * from './modules/dcql'
export {
  JsonEncoder,
  JsonTransformer,
  TypedArrayEncoder,
  MultiBaseEncoder,
  MultiHashEncoder,
  HashlinkEncoder,
  BaseName,
  Buffer,
  deepEquality,
  isDid,
  IsUri,
  IsStringOrInstance,
  asArray,
  equalsIgnoreOrder,
  equalsWithOrder,
  DateTransformer,
  IsStringOrStringArray,
} from './utils'
export * from './logger'
export * from './error'
export type { Constructor, Constructable } from './utils/mixins'
export * from './agent/Events'
export * from './crypto'

// TODO: Clean up these exports used by DIDComm module
export {
  didKeyToEd25519PublicJwk,
  didKeyToVerkey,
  verkeyToDidKey,
  verkeyToPublicJwk,
  isDidKey,
} from './modules/dids/helpers'
export { tryParseDid } from './modules/dids/domain/parse'
export { base64ToBase64URL } from './utils/base64'
export { DidRecordMetadataKeys } from './modules/dids/repository/didRecordMetadataTypes'
export { didDocumentJsonToNumAlgo1Did } from './modules/dids/methods/peer/peerDidNumAlgo1'
export { didDocumentToNumAlgo2Did } from './modules/dids/methods/peer/peerDidNumAlgo2'
export { didDocumentToNumAlgo4Did } from './modules/dids/methods/peer/peerDidNumAlgo4'

export { getDomainFromUrl } from './utils/domain'
export { MessageValidator } from './utils'

import { indyDidFromPublicKeyBase58 } from './utils/did'
import { areObjectsEqual } from './utils/objectEquality'
import timestamp from './utils/timestamp'
import { addSecondsToDate, dateToSeconds, nowInSeconds } from './utils/timestamp'
import { getProtocolScheme } from './utils/uri'
import { isValidUuid, uuid } from './utils/uuid'

const utils = {
  areObjectsEqual,
  uuid,
  isValidUuid,
  getProtocolScheme,
  timestamp,
  indyDidFromPublicKeyBase58,
  nowInSeconds,
  dateToSeconds,
  addSecondsToDate,
}

export { utils }
